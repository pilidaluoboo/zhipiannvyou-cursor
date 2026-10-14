import type { Girlfriend } from "./girlfriends";

export interface ChatMessage {
  id: string;
  role: "user" | "girlfriend" | "system";
  type: "text" | "voice" | "image" | "system";
  content: string;
  audioUrl?: string;
  imageUrl?: string;
  timestamp: number;
}

export interface ChatSession {
  girlfriendId: string;
  messages: ChatMessage[];
  intimacy: number;
  messageCount: number;
  lastSelfieAt: number;
  avatarUrl?: string;
  /** 上次定时早安/问候写入时间（防同一天重复） */
  lastMorningGreetingAt?: number;
}

export function createSession(girlfriend: Girlfriend): ChatSession {
  return {
    girlfriendId: girlfriend.id,
    messages: [
      {
        id: crypto.randomUUID(),
        role: "girlfriend",
        type: "text",
        content: girlfriend.greeting,
        timestamp: Date.now(),
      },
    ],
    intimacy: 1,
    messageCount: 0,
    lastSelfieAt: 0,
    avatarUrl: undefined,
  };
}

export function shouldTriggerSelfie(session: ChatSession): boolean {
  const messagesSinceSelfie = session.messageCount - session.lastSelfieAt;
  // Fixed deterministic threshold: 10 messages
  return messagesSinceSelfie >= 10;
}

export function isPhotoRequest(text: string): boolean {
  const lowerText = text.toLowerCase();
  const photoKeywords = ["照片", "自拍", "看看你", "发张", "发照片", "发图", "看看你长什么样", "你的照片", "你的自拍", "发个照片", "发个自拍", "给我看", "想看你", "露个脸", "拍张照", "拍个照", "照个相", "发张自拍"];
  return photoKeywords.some((keyword) => lowerText.includes(keyword));
}

export function getIntimacyLevel(intimacy: number): string {
  if (intimacy <= 2) return "初识";
  if (intimacy <= 4) return "熟悉";
  if (intimacy <= 6) return "亲密";
  if (intimacy <= 8) return "热恋";
  return "挚爱";
}

export function getIntimacyModifier(intimacy: number): string {
  if (intimacy <= 2) return "礼貌但友好地";
  if (intimacy <= 4) return "温暖亲切地";
  if (intimacy <= 6) return "亲密甜蜜地";
  if (intimacy <= 8) return "深情热情地";
  return "深情款款、如胶似漆地";
}
