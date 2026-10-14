import type { ChatSession } from "@/lib/chat-session";

export async function loadChatSession(options: {
  deviceId: string;
  girlfriendId: string;
}): Promise<ChatSession | null> {
  const params = new URLSearchParams({
    deviceId: options.deviceId,
    girlfriendId: options.girlfriendId,
  });
  const res = await fetch(`/api/chat-session?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("加载聊天记录失败");
  }
  const data = (await res.json()) as { session?: ChatSession | null };
  return data.session ?? null;
}

export async function saveChatSession(options: {
  deviceId: string;
  girlfriendId: string;
  session: ChatSession;
}): Promise<void> {
  const res = await fetch("/api/chat-session", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: options.deviceId,
      girlfriendId: options.girlfriendId,
      session: options.session,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "保存聊天记录失败");
  }
}
