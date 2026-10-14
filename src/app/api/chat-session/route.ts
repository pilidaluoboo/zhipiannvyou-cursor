import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

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

export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim() || "";
    const girlfriendId =
      request.nextUrl.searchParams.get("girlfriendId")?.trim() || "";
    if (!deviceId || !girlfriendId) {
      return NextResponse.json(
        { error: "缺少 deviceId 或 girlfriendId" },
        { status: 400 }
      );
    }

    const { baseUrl, secret } = getStoreConfig();
    const url = new URL(`${baseUrl}/session`);
    url.searchParams.set("deviceId", deviceId);
    url.searchParams.set("girlfriendId", girlfriendId);

    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: storeHeaders(secret),
      cache: "no-store",
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "加载聊天记录失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const deviceId =
      typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const girlfriendId =
      typeof body.girlfriendId === "string" ? body.girlfriendId.trim() : "";
    if (!deviceId || !girlfriendId || !body.session) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const { baseUrl, secret } = getStoreConfig();
    const upstream = await fetch(`${baseUrl}/session`, {
      method: "PUT",
      headers: storeHeaders(secret),
      body: JSON.stringify({
        deviceId,
        girlfriendId,
        session: body.session,
      }),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "保存聊天记录失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
