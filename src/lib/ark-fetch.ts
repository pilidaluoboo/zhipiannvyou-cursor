/**
 * 方舟请求公共头：支持经 Cloudflare Worker 反代时的共享密钥。
 */
export function arkRequestHeaders(apiKey: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const proxySecret = process.env.ARK_PROXY_SECRET?.trim();
  if (proxySecret) {
    headers["x-ark-proxy-secret"] = proxySecret;
  }

  return headers;
}
