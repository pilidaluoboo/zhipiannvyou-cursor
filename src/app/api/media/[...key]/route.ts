import { NextRequest, NextResponse } from "next/server";
import { assertSafeMediaKey, createPresignedGetUrl } from "@/lib/r2";

export const maxDuration = 30;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key: keyParts } = await context.params;
    const key = assertSafeMediaKey(keyParts.join("/"));
    const signedUrl = await createPresignedGetUrl(key, 300);

    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "图片访问失败";
    const status =
      message.includes("非法") || message.includes("缺少")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
