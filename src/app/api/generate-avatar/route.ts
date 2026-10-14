import { NextRequest, NextResponse } from "next/server";
import {
  generateArkImage,
  resolveReferenceImage,
} from "@/lib/ark-seedream";

export async function POST(request: NextRequest) {
  const { prompt, referenceImageUrl } = await request.json();

  if (!prompt) {
    return NextResponse.json(
      { error: "缺少必要参数" },
      { status: 400 }
    );
  }

  try {
    const referenceImage = await resolveReferenceImage(referenceImageUrl);
    const result = await generateArkImage({
      prompt,
      referenceImage,
      size: "2K",
      watermark: false,
    });

    return NextResponse.json({
      imageUrl: result.imageUrl,
      imageUrls: result.imageUrls,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "图像生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
