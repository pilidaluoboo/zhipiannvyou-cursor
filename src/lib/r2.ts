import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const ALLOWED_PREFIXES = ["selfies/", "avatars/"] as const;

export type R2MediaKind = "selfies" | "avatars";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少 ${name}，请在 .env.local / Vercel 中配置`);
  }
  return value;
}

function getR2Config() {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requireEnv("R2_BUCKET_NAME");
  const endpoint = (
    process.env.R2_ENDPOINT?.trim() ||
    `https://${accountId}.r2.cloudflarestorage.com`
  ).replace(/\/$/, "");

  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint };
}

let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const { accessKeyId, secretAccessKey, endpoint } = getR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  return cachedClient;
}

function extFromContentType(contentType: string): string {
  const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  switch (normalized) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/jpeg":
    case "image/jpg":
    default:
      return "jpg";
  }
}

function sniffContentType(bytes: Uint8Array, fallback?: string | null): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (fallback?.startsWith("image/")) return fallback;
  return "image/jpeg";
}

/** 校验媒体 key，防止路径穿越与越权读取 */
export function assertSafeMediaKey(key: string): string {
  const normalized = key.replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\\")) {
    throw new Error("非法媒体路径");
  }
  if (!ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error("非法媒体路径");
  }
  return normalized;
}

export function buildMediaUrl(key: string): string {
  const safeKey = assertSafeMediaKey(key);
  return `/api/media/${safeKey}`;
}

/**
 * 从方舟临时 URL 或 data URL 下载图片字节
 */
export async function downloadImageBytes(
  sourceUrl: string
): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (sourceUrl.startsWith("data:image/")) {
    const comma = sourceUrl.indexOf(",");
    const header = comma >= 0 ? sourceUrl.slice(0, comma) : "";
    const payload = comma >= 0 ? sourceUrl.slice(comma + 1) : "";
    const typeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64$/i.exec(header);
    if (!typeMatch || !payload) {
      throw new Error("无法解析图片 data URL");
    }
    const contentType = typeMatch[1];
    const bytes = new Uint8Array(Buffer.from(payload, "base64"));
    return { bytes, contentType: sniffContentType(bytes, contentType) };
  }

  let response: Response;
  try {
    response = await fetch(sourceUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "网络错误";
    throw new Error(`下载生成图片失败: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`下载生成图片失败 (HTTP ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length === 0) {
    throw new Error("下载生成图片失败: 空内容");
  }

  const headerType = response.headers.get("content-type");
  return {
    bytes,
    contentType: sniffContentType(bytes, headerType),
  };
}

export async function uploadImageToR2(options: {
  kind: R2MediaKind;
  bytes: Uint8Array;
  contentType: string;
  folderHint?: string;
}): Promise<{ key: string; mediaUrl: string }> {
  const { bucket } = getR2Config();
  const client = getR2Client();
  const ext = extFromContentType(options.contentType);
  const folder = options.folderHint
    ? options.folderHint.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "misc"
    : "misc";
  const key = assertSafeMediaKey(
    `${options.kind}/${folder}/${randomUUID()}.${ext}`
  );

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: options.bytes,
        ContentType: options.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    throw new Error(`图片保存失败: ${message}`);
  }

  return { key, mediaUrl: buildMediaUrl(key) };
}

/**
 * 生成后转存 R2；任一步失败都抛错（调用方不得回退临时链接）
 */
export async function persistGeneratedImage(options: {
  sourceUrl: string;
  kind: R2MediaKind;
  folderHint?: string;
}): Promise<string> {
  const { bytes, contentType } = await downloadImageBytes(options.sourceUrl);
  const { mediaUrl } = await uploadImageToR2({
    kind: options.kind,
    bytes,
    contentType,
    folderHint: options.folderHint,
  });
  return mediaUrl;
}

export async function createPresignedGetUrl(
  key: string,
  expiresInSeconds = 300
): Promise<string> {
  const safeKey = assertSafeMediaKey(key);
  const { bucket } = getR2Config();
  const client = getR2Client();

  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: safeKey,
      }),
      { expiresIn: expiresInSeconds }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    throw new Error(`无法生成图片访问链接: ${message}`);
  }
}
