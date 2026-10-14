/**
 * 火山方舟反向代理（Cloudflare Worker）
 * 解决 Vercel 等海外节点无法直连 ark.cn-beijing.volces.com 的问题。
 *
 * 客户端把 ARK_BASE_URL 设为 https://<worker>.workers.dev/api/v3
 * 并在请求头带上 x-ark-proxy-secret（与 Worker 的 PROXY_SECRET 一致）。
 */

const UPSTREAM = "https://ark.cn-beijing.volces.com";

interface Env {
  PROXY_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    const secret = env.PROXY_SECRET?.trim();
    if (secret) {
      const provided = request.headers.get("x-ark-proxy-secret")?.trim();
      if (provided !== secret) {
        return json({ error: "Unauthorized proxy access" }, 401, request);
      }
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/v3")) {
      return json(
        {
          error: "Not found",
          hint: "Use base URL https://<this-worker>/api/v3",
        },
        404,
        request
      );
    }

    const upstreamUrl = `${UPSTREAM}${url.pathname}${url.search}`;
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("x-ark-proxy-secret");
    headers.set("host", "ark.cn-beijing.volces.com");

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : request.body,
        // @ts-expect-error undici/CF streaming
        duplex: "half",
        redirect: "manual",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upstream fetch failed";
      return json({ error: `Ark upstream unreachable: ${message}` }, 502, request);
    }

    const responseHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders(request))) {
      responseHeaders.set(k, v);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, x-ark-proxy-secret",
    "Access-Control-Max-Age": "86400",
  };
}

function json(
  body: unknown,
  status: number,
  request: Request
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request),
    },
  });
}
