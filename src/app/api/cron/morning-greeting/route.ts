import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { invokeArkChat } from "@/lib/ark-llm";
import { getGirlfriend } from "@/lib/girlfriends";
import type { ChatMessage, ChatSession } from "@/lib/chat-session";

export const maxDuration = 60;

const TARGET_GIRLFRIEND_ID = "yaqi";
const ONE_DAY_MS = 20 * 60 * 60 * 1000; // 20h 内不重复

function assertCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization")?.trim() || "";
  if (header === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get("secret")?.trim();
  return querySecret === secret;
}

function getStoreConfig() {
  const baseUrl = (
    process.env.CHAT_STORE_URL?.trim() ||
    "https://zhipiannvyou-chat-store.zhipiannvyou.workers.dev"
  ).replace(/\/$/, "");
  const secret = process.env.CHAT_STORE_SECRET?.trim();
  if (!secret) {
    throw new Error("缺少 CHAT_STORE_SECRET");
  }
  return { baseUrl, secret };
}

function storeHeaders(secret: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-chat-store-secret": secret,
  };
}

async function generateYaqiGreeting(): Promise<string> {
  const yaqi = getGirlfriend(TARGET_GIRLFRIEND_ID);
  if (!yaqi) {
    return "早上好呀～新的一天也要好好的呢。";
  }

  try {
    const text = await invokeArkChat({
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: `${yaqi.systemPrompt}\n\n现在请以雅琪的身份，给用户发一句简短温暖的问候（今天用来测试定时提醒，语气自然即可，不要提“定时任务/系统”）。只要一句，20-40字。`,
        },
        {
          role: "user",
          content: "发一句现在的问候给我吧。",
        },
      ],
    });
    if (text) return text;
  } catch {
    // fall through
  }

  return "嗯～想你了，现在还好吗？我一直都在。";
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  if (!assertCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { baseUrl, secret } = getStoreConfig();
    const listRes = await fetch(
      `${baseUrl}/sessions?girlfriendId=${encodeURIComponent(TARGET_GIRLFRIEND_ID)}`,
      {
        method: "GET",
        headers: storeHeaders(secret),
        cache: "no-store",
      }
    );
    const listData = (await listRes.json()) as {
      sessions?: Array<{
        deviceId: string;
        girlfriendId: string;
        session: ChatSession;
      }>;
      error?: string;
    };

    if (!listRes.ok) {
      return NextResponse.json(
        { error: listData.error || "读取会话失败" },
        { status: 500 }
      );
    }

    const sessions = listData.sessions || [];
    if (sessions.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        skipped: 0,
        message: "没有雅琪会话可写入",
      });
    }

    const greetingText = await generateYaqiGreeting();
    const now = Date.now();
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of sessions) {
      const session = item.session;
      if (!session || !Array.isArray(session.messages)) {
        skipped += 1;
        continue;
      }

      if (
        session.lastMorningGreetingAt &&
        now - session.lastMorningGreetingAt < ONE_DAY_MS
      ) {
        skipped += 1;
        continue;
      }

      const greetingMessage: ChatMessage = {
        id: randomUUID(),
        role: "girlfriend",
        type: "text",
        content: greetingText,
        timestamp: now,
      };

      const nextSession: ChatSession = {
        ...session,
        girlfriendId: TARGET_GIRLFRIEND_ID,
        messages: [...session.messages, greetingMessage],
        lastMorningGreetingAt: now,
      };

      const putRes = await fetch(`${baseUrl}/session`, {
        method: "PUT",
        headers: storeHeaders(secret),
        body: JSON.stringify({
          deviceId: item.deviceId,
          girlfriendId: TARGET_GIRLFRIEND_ID,
          session: nextSession,
        }),
      });

      if (!putRes.ok) {
        const errBody = (await putRes.json().catch(() => ({}))) as {
          error?: string;
        };
        errors.push(
          `${item.deviceId}: ${errBody.error || `HTTP ${putRes.status}`}`
        );
        continue;
      }
      updated += 1;
    }

    return NextResponse.json({
      ok: true,
      girlfriendId: TARGET_GIRLFRIEND_ID,
      greeting: greetingText,
      updated,
      skipped,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "定时问候失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
