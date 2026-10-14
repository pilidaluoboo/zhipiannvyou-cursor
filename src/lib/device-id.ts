const STORAGE_KEY = "zhipiannvyou_device_id";

/** 本机匿名设备 ID：同一浏览器可关联云端会话，换浏览器则不同 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)?.trim();
    if (existing) return existing;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // localStorage 不可用时退化为会话级 ID（刷新会丢）
    return `ephemeral_${Date.now().toString(36)}`;
  }
}
