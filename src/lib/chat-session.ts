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

/** 用户在追问身份/照片真实性，不应触发自拍生成。 */
export function isPhotoRealityMetaQuestion(text: string): boolean {
  const t = text.trim();
  if (/(真人|是不是真人|你是ai|是ai吗|虚构)/i.test(t)) return true;
  if (/(照片|自拍|这张|图片|图).{0,12}(真实|实拍|假的|生成|ai)/i.test(t)) {
    return true;
  }
  if (/(真实|实拍|假的|生成|ai).{0,12}(照片|自拍|拍摄)/i.test(t)) {
    return true;
  }
  return false;
}

/** 用户明确想看角色照片/自拍（会触发应用内自拍生成）。 */
export function isPhotoRequest(text: string): boolean {
  if (isPhotoRealityMetaQuestion(text)) return false;
  const lowerText = text.toLowerCase();
  const photoKeywords = [
    "照片",
    "自拍",
    "看看你",
    "发张",
    "发照片",
    "发图",
    "看看你长什么样",
    "你的照片",
    "你的自拍",
    "发个照片",
    "发个自拍",
    "给我看",
    "想看你",
    "露个脸",
    "拍张照",
    "拍个照",
    "照个相",
    "发张自拍",
    "现在的样子",
  ];
  return photoKeywords.some((keyword) => lowerText.includes(keyword));
}

/**
 * 传给聊天模型的本回合功能上下文：应用已启动自拍生成。
 * 不改写角色人设，只约束本回合如何配合功能。
 */
export function buildSelfiePendingFeatureContext(name: string): string {
  return [
    `应用状态：用户正在向「${name}」索要照片/自拍；客户端已启动角色自拍图生成，图片将在你这句文字回复之后由系统发送。`,
    "回复要求：用符合你人设的口吻自然答应并配合（例如稍等、这就拍一张、等我发给你），不要拒绝，不要说自己没有照片、没法展示或无法发图。",
    "时序：本回合只输出文字；不要声称图片已经发出、对方已经看到，或发送成功。",
    "身份诚实（仅当用户追问时适用）：若用户问你是否真人，或问照片是否现实中真实拍摄，仍须如实说明你是虚构的AI陪伴角色，应用内图片是角色形象生成图，不是真人实拍。",
  ].join("\n");
}

/** 用户追问身份/照片是否实拍时注入，避免用虚构生活细节把生成图说成真人摄影。 */
export function buildIdentityHonestyFeatureContext(): string {
  return [
    "应用状态：用户在追问你是否真人，或追问应用内照片/自拍是否现实中真实拍摄。",
    "回复要求：如实说明你是虚构的AI陪伴角色；聊天里的角色照片与自拍是应用生成的角色形象图，不是现实中的真人实拍。",
    "不要用「去年在某地拍的」「当然是真的」等说辞，把生成图说成真实摄影。语气仍保持人设，但事实必须诚实。",
  ].join("\n");
}

/** 自拍生成失败时的角色口吻提示（非 LLM）。 */
export function getSelfieFailureCharacterLine(girlfriendId: string): string {
  switch (girlfriendId) {
    case "xiaoning":
      return "诶，这张没传上去……等下再拍一张给你嘿嘿。";
    case "yaqi":
      return "抱歉，这张好像没发出去。我晚点再试一次好吗？";
    case "yingzi":
      return "哼，信号不好传失败了啦……才不是不想给你看。";
    case "bingxin":
      return "发送失败了。稍后再试一次。";
    default:
      return "这张没发出去，稍后再试一次吧。";
  }
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
