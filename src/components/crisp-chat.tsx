"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Crisp } from "crisp-sdk-web";

function isChatRoute(pathname: string | null): boolean {
  return !!pathname?.startsWith("/chat");
}

function syncCrispForPath(pathname: string | null) {
  if (isChatRoute(pathname)) {
    // 聊天页右下角是发送按钮；Crisp 气泡同位置且层级更高，会抢走点击
    try {
      if (Crisp.chat.isChatOpened()) {
        Crisp.chat.close();
      }
    } catch {
      // Crisp 尚未注入时忽略
    }
    Crisp.chat.hide();
    return;
  }
  Crisp.chat.show();
}

/**
 * Crisp 默认贴右下角、z-index 极高。
 * 在 /chat/* 隐藏客服气泡，避免遮挡发送按钮；其它页面正常显示。
 */
export function CrispChat() {
  const pathname = usePathname();

  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim();
    if (!websiteId) return;
    Crisp.configure(websiteId);
  }, []);

  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim();
    if (!websiteId) return;

    const sync = () => syncCrispForPath(pathname);
    sync();

    // 脚本异步加载完成后再次同步，避免首屏竞态
    if (typeof window !== "undefined") {
      window.$crisp = window.$crisp || [];
      window.$crisp.push(["on", "session:loaded", sync]);
    }

    return () => {
      if (typeof window !== "undefined" && Array.isArray(window.$crisp)) {
        window.$crisp.push(["off", "session:loaded"]);
      }
    };
  }, [pathname]);

  return null;
}
