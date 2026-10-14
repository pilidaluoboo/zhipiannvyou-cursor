import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const maxDuration = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "请输入有效邮箱" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
    const templateId =
      process.env.RESEND_WELCOME_TEMPLATE_ID?.trim() ||
      "untitled-template";

    if (!apiKey) {
      return NextResponse.json(
        { error: "缺少 RESEND_API_KEY" },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: email,
      template: {
        id: templateId,
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "邮件发送失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: data?.id,
      to: email,
      templateId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "邮件发送失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
