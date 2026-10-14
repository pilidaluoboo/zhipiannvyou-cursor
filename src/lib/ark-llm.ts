import { setDefaultResultOrder } from "dns";
import { formatFetchError } from "@/lib/ark-errors";

// 部分云厂商 IPv6 解析会导致访问国内方舟失败
try {
  setDefaultResultOrder("ipv4first");
} catch {
  // ignore
}

export interface ArkChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function getArkConfig() {
  const apiKey = process.env.ARK_API_KEY?.trim();
  const model = process.env.ARK_LLM_MODEL?.trim();
  const baseUrl = (
    process.env.ARK_BASE_URL?.trim() ||
    "https://ark.cn-beijing.volces.com/api/v3"
  ).replace(/\/$/, "");

  if (!apiKey) {
    throw new Error("缺少 ARK_API_KEY，请在 .env.local 中配置");
  }
  if (!model) {
    throw new Error(
      "缺少 ARK_LLM_MODEL，请填写文字模型接入点（如 ep-m-xxxx）"
    );
  }

  return { apiKey, model, baseUrl };
}

/**
 * 火山方舟 Chat Completions 流式输出（OpenAI 兼容）
 * 产出每个增量文本片段
 */
export async function* streamArkChat(options: {
  messages: ArkChatMessage[];
  temperature?: number;
}): AsyncGenerator<string, void, unknown> {
  const { apiKey, model, baseUrl } = getArkConfig();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.85,
        stream: true,
      }),
    });
  } catch (error) {
    throw new Error(formatFetchError("文字模型", error));
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let message = `文字模型调用失败 (HTTP ${response.status})`;
    try {
      const parsed = JSON.parse(errText) as {
        error?: { message?: string };
      };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      if (errText) message = `${message}: ${errText.slice(0, 300)}`;
    }
    throw new Error(message);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("文字模型未返回可读流");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;

      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const content = json.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // 忽略不完整 JSON 行
      }
    }
  }
}
