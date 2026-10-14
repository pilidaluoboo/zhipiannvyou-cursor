/**
 * 本地方舟反代：本机可直连 ark.cn-beijing，供隧道/调试使用。
 * 用法: PROXY_SECRET=xxx node scripts/local-ark-proxy.mjs
 */
import http from "node:http";
import { Readable } from "node:stream";

const UPSTREAM = "https://ark.cn-beijing.volces.com";
const PORT = Number(process.env.PORT || 8787);
const SECRET = (process.env.PROXY_SECRET || "").trim();

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, x-ark-proxy-secret",
    });
    res.end();
    return;
  }

  if (SECRET) {
    const provided = (req.headers["x-ark-proxy-secret"] || "").toString().trim();
    if (provided !== SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized proxy access" }));
      return;
    }
  }

  if (!req.url?.startsWith("/api/v3")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  try {
    const upstream = await fetch(`${UPSTREAM}${req.url}`, {
      method: req.method,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        Authorization: req.headers.authorization || "",
      },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });

    const headers = {
      "Content-Type":
        upstream.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": upstream.headers.get("cache-control") || "no-cache",
      "Access-Control-Allow-Origin": "*",
    };
    res.writeHead(upstream.status, headers);

    if (!upstream.body) {
      res.end();
      return;
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxy failed";
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(PORT, () => {
  console.log(`local ark proxy on http://127.0.0.1:${PORT}/api/v3`);
});
