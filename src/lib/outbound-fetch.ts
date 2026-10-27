/**
 * Server-side outbound HTTP that respects HTTPS_PROXY / ALL_PROXY.
 * Node's global fetch often ignores proxy env; local Clash/fake-ip then
 * breaks Ark TOS downloads and Worker calls.
 */
import { ProxyAgent, fetch as undiciFetch } from "undici";

let cachedAgent: ProxyAgent | undefined;
let cachedProxyUrl: string | undefined;

function resolveProxyUrl(): string | undefined {
  const proxy =
    process.env.https_proxy?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.ALL_PROXY?.trim() ||
    process.env.all_proxy?.trim() ||
    process.env.http_proxy?.trim() ||
    process.env.HTTP_PROXY?.trim();
  return proxy || undefined;
}

function getDispatcher(): ProxyAgent | undefined {
  const proxyUrl = resolveProxyUrl();
  if (!proxyUrl) return undefined;
  if (!cachedAgent || cachedProxyUrl !== proxyUrl) {
    cachedAgent = new ProxyAgent(proxyUrl);
    cachedProxyUrl = proxyUrl;
  }
  return cachedAgent;
}

export type OutboundFetchInit = {
  method?: string;
  headers?: HeadersInit;
  body?: string | Buffer | Uint8Array | null;
  signal?: AbortSignal;
  /** Extra undici retries after the first attempt. Default 2 (3 total). */
  retries?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function outboundFetch(
  url: string,
  init: OutboundFetchInit = {}
): Promise<Response> {
  const { retries = 2, ...rest } = init;
  const dispatcher = getDispatcher();
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await undiciFetch(url, {
        method: rest.method,
        headers: rest.headers as Record<string, string> | undefined,
        body: rest.body ?? undefined,
        signal: rest.signal,
        ...(dispatcher ? { dispatcher } : {}),
      });
      // undici Response is compatible enough for our callers (ok/status/json/arrayBuffer)
      return response as unknown as Response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(400 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("outbound fetch failed");
}
