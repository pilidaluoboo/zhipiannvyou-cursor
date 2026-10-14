/**
 * 聊天会话存储 Worker（D1）
 * GET  /session?deviceId=&girlfriendId=
 * PUT  /session  JSON { deviceId, girlfriendId, session }
 * GET  /sessions?girlfriendId=   列出某角色全部会话（定时任务用）
 */

export interface Env {
  DB: D1Database;
  CHAT_STORE_SECRET?: string;
}

type SessionBody = {
  deviceId?: string;
  girlfriendId?: string;
  session?: unknown;
};

type StoredSession = {
  girlfriendId?: string;
  messages?: unknown[];
  intimacy?: number;
  messageCount?: number;
  lastSelfieAt?: number;
  avatarUrl?: string;
  lastMorningGreetingAt?: number;
  [key: string]: unknown;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-chat-store-secret",
      "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    },
  });
}

function unauthorized(): Response {
  return json({ error: "Unauthorized" }, 401);
}

function assertAuth(request: Request, env: Env): boolean {
  const secret = env.CHAT_STORE_SECRET?.trim();
  if (!secret) return true;
  return request.headers.get("x-chat-store-secret")?.trim() === secret;
}

function sessionId(deviceId: string, girlfriendId: string): string {
  return `${deviceId}:${girlfriendId}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return json({}, 204);
    }

    if (!assertAuth(request, env)) {
      return unauthorized();
    }

    const url = new URL(request.url);

    if (url.pathname === "/sessions" && request.method === "GET") {
      const girlfriendId = url.searchParams.get("girlfriendId")?.trim() || "";
      if (!girlfriendId) {
        return json({ error: "缺少 girlfriendId" }, 400);
      }

      const result = await env.DB.prepare(
        `SELECT device_id, girlfriend_id, payload FROM chat_sessions WHERE girlfriend_id = ?`
      )
        .bind(girlfriendId)
        .all<{ device_id: string; girlfriend_id: string; payload: string }>();

      const sessions = (result.results || [])
        .filter((row) => row.device_id && !row.device_id.startsWith("smoke"))
        .map((row) => {
          try {
            return {
              deviceId: row.device_id,
              girlfriendId: row.girlfriend_id,
              session: JSON.parse(row.payload) as StoredSession,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      return json({ sessions });
    }

    if (url.pathname !== "/session") {
      return json({ error: "Not found" }, 404);
    }

    if (request.method === "GET") {
      const deviceId = url.searchParams.get("deviceId")?.trim() || "";
      const girlfriendId = url.searchParams.get("girlfriendId")?.trim() || "";
      if (!deviceId || !girlfriendId) {
        return json({ error: "缺少 deviceId 或 girlfriendId" }, 400);
      }

      const row = await env.DB.prepare(
        `SELECT payload FROM chat_sessions WHERE id = ?`
      )
        .bind(sessionId(deviceId, girlfriendId))
        .first<{ payload: string }>();

      if (!row?.payload) {
        return json({ session: null });
      }

      try {
        return json({ session: JSON.parse(row.payload) });
      } catch {
        return json({ error: "会话数据损坏" }, 500);
      }
    }

    if (request.method === "PUT") {
      let body: SessionBody;
      try {
        body = (await request.json()) as SessionBody;
      } catch {
        return json({ error: "无效 JSON" }, 400);
      }

      const deviceId = body.deviceId?.trim() || "";
      const girlfriendId = body.girlfriendId?.trim() || "";
      if (!deviceId || !girlfriendId || !body.session) {
        return json({ error: "缺少必要参数" }, 400);
      }

      if (deviceId.length > 128 || girlfriendId.length > 64) {
        return json({ error: "参数过长" }, 400);
      }

      const payload = JSON.stringify(body.session);
      if (payload.length > 1_500_000) {
        return json({ error: "会话过大" }, 413);
      }

      const id = sessionId(deviceId, girlfriendId);
      const updatedAt = Date.now();

      await env.DB.prepare(
        `INSERT INTO chat_sessions (id, device_id, girlfriend_id, payload, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`
      )
        .bind(id, deviceId, girlfriendId, payload, updatedAt)
        .run();

      return json({ ok: true, updatedAt });
    }

    return json({ error: "Method not allowed" }, 405);
  },
};
