import { NextRequest, NextResponse } from "next/server";
import { streamArkChat, type ArkChatMessage } from "@/lib/ark-llm";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { messages, systemPrompt, intimacyModifier, featureContext } =
    await request.json();

  if (!messages || !systemPrompt) {
    return NextResponse.json(
      { error: "缺少必要参数" },
      { status: 400 }
    );
  }

  let fullSystemPrompt = `${systemPrompt}\n\n当前亲密程度：请${intimacyModifier || "温暖亲切地"}回复。`;

  // 本回合应用功能上下文（如自拍生成中），由前端按意图注入，不改写角色人设正文。
  if (typeof featureContext === "string" && featureContext.trim()) {
    fullSystemPrompt += `\n\n【本回合应用功能上下文｜优先于模糊猜测】\n${featureContext.trim()}`;
  }

  const allMessages: ArkChatMessage[] = [
    { role: "system", content: fullSystemPrompt },
    ...messages,
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const text of streamArkChat({
          messages: allMessages,
          temperature: 0.85,
        })) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`)
          );
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "生成回复失败";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
