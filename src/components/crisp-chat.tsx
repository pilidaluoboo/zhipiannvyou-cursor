"use client";

import { useEffect } from "react";
import { Crisp } from "crisp-sdk-web";

export function CrispChat() {
  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim();
    if (!websiteId) return;
    Crisp.configure(websiteId);
  }, []);

  return null;
}
