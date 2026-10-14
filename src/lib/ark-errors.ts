/** 把 Node fetch 失败转成可读错误（Vercel 上常见只有 "fetch failed"） */
export function formatFetchError(action: string, error: unknown): string {
  if (!(error instanceof Error)) {
    return `${action}请求失败`;
  }

  const parts = [`${action}请求失败: ${error.message}`];
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    const c = cause as {
      code?: string;
      errno?: string;
      syscall?: string;
      hostname?: string;
      message?: string;
    };
    const detail = [c.code, c.syscall, c.hostname, c.message]
      .filter(Boolean)
      .join(" ");
    if (detail) parts.push(`(${detail})`);
  }

  return parts.join(" ");
}
