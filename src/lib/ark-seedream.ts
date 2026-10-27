import { setDefaultResultOrder } from "dns";
import { readFile } from "fs/promises";
import path from "path";
import { formatFetchError } from "@/lib/ark-errors";
import { arkRequestHeaders } from "@/lib/ark-fetch";
import { outboundFetch } from "@/lib/outbound-fetch";

try {
  setDefaultResultOrder("ipv4first");
} catch {
  // ignore
}

export interface ArkImageGenerateOptions {
  prompt: string;
  referenceImage?: string;
  size?: string;
  watermark?: boolean;
}

export interface ArkImageGenerateResult {
  imageUrl: string;
  imageUrls: string[];
}

function getArkConfig() {
  const apiKey = process.env.ARK_API_KEY?.trim();
  const model = process.env.ARK_SEEDREAM_MODEL?.trim();
  const baseUrl = (
    process.env.ARK_BASE_URL?.trim() ||
    "https://ark.cn-beijing.volces.com/api/v3"
  ).replace(/\/$/, "");

  if (!apiKey) {
    throw new Error("缺少 ARK_API_KEY，请在 .env.local 中配置");
  }
  if (!model) {
    throw new Error("缺少 ARK_SEEDREAM_MODEL，请在 .env.local 中配置");
  }

  return { apiKey, model, baseUrl };
}

function mimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
}

/**
 * 将参考图转为方舟可访问的形式：
 * - http(s) URL：原样使用
 * - 本地相对路径（如 /avatars/xxx.jpeg）：读 public 转 data URL
 */
export async function resolveReferenceImage(
  imageUrl: string | undefined
): Promise<string | undefined> {
  if (!imageUrl) return undefined;

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("data:image/")) {
    return imageUrl;
  }

  const relative = imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
  const filePath = path.join(process.cwd(), "public", relative);

  try {
    const buf = await readFile(filePath);
    const mime = mimeFromExt(path.extname(filePath));
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    // 本地文件读不到时，尝试用项目域名拼绝对地址（部署场景）
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT;
    if (domain) {
      const base = domain.startsWith("http") ? domain : `https://${domain}`;
      return `${base}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
    }
    return undefined;
  }
}

export async function generateArkImage(
  options: ArkImageGenerateOptions
): Promise<ArkImageGenerateResult> {
  const { apiKey, model, baseUrl } = getArkConfig();

  const body: Record<string, unknown> = {
    model,
    prompt: options.prompt,
    size: options.size ?? "2K",
    response_format: "url",
    watermark: options.watermark ?? false,
  };

  if (options.referenceImage) {
    body.image = options.referenceImage;
  }

  let response: Response;
  try {
    response = await outboundFetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: arkRequestHeaders(apiKey),
      body: JSON.stringify(body),
      retries: 2,
    });
  } catch (error) {
    throw new Error(formatFetchError("图片生成", error));
  }

  const data = (await response.json()) as {
    error?: { message?: string; code?: string };
    data?: Array<{ url?: string; b64_json?: string }>;
  };

  if (!response.ok) {
    const message =
      data.error?.message ||
      `火山方舟图片生成失败 (HTTP ${response.status})`;
    throw new Error(message);
  }

  const imageUrls =
    data.data
      ?.map((item) => {
        if (item.url) return item.url;
        if (item.b64_json) return `data:image/jpeg;base64,${item.b64_json}`;
        return undefined;
      })
      .filter((url): url is string => Boolean(url)) ?? [];

  if (imageUrls.length === 0) {
    throw new Error("火山方舟未返回图片");
  }

  return {
    imageUrl: imageUrls[0],
    imageUrls,
  };
}
