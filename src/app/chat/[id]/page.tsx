"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getGirlfriend, USER_AVATAR_URL, type Girlfriend } from "@/lib/girlfriends";
import {
  type ChatMessage,
  type ChatSession,
  createSession,
  shouldTriggerSelfie,
  isPhotoRequest,
  isPhotoRealityMetaQuestion,
  buildSelfiePendingFeatureContext,
  buildIdentityHonestyFeatureContext,
  getSelfieFailureCharacterLine,
  getIntimacyLevel,
  getIntimacyModifier,
} from "@/lib/chat-session";
import { getOrCreateDeviceId } from "@/lib/device-id";
import {
  loadChatSession,
  saveChatSession,
} from "@/lib/chat-store-client";
import { buildSelfiePrompt } from "@/lib/selfie-prompt";

// ===== Sub-components =====

function TypingIndicator({ girlfriend }: { girlfriend: Girlfriend }) {
  return (
    <div className="flex items-start gap-2 mb-3">
      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
        <img
          src={girlfriend.avatarUrl}
          alt={girlfriend.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="bg-white rounded-xl px-4 py-3 shadow-sm">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function TextBubble({
  message,
  girlfriend,
  userAvatarUrl,
  isPlaying,
  onPlay,
  ttsLoading,
}: {
  message: ChatMessage;
  girlfriend: Girlfriend;
  userAvatarUrl: string;
  isPlaying: boolean;
  onPlay: () => void;
  ttsLoading: boolean;
}) {
  const isUser = message.role === "user";
  const hasAudio = !!message.audioUrl;
  return (
    <div className={`flex items-start gap-2 mb-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser ? (
        <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
          <img
            src={girlfriend.avatarUrl}
            alt={girlfriend.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
          <img src={userAvatarUrl} alt="我" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex items-center gap-1.5 max-w-[75%]">
        <div
          className={`px-4 py-2.5 shadow-sm whitespace-pre-wrap break-words text-[15px] leading-relaxed rounded-xl ${
            isUser
              ? "bg-[#95EC69] text-gray-800"
              : "bg-white text-gray-800"
          }`}
        >
          {message.content}
        </div>
        {!isUser && (
          <button
            onClick={onPlay}
            disabled={ttsLoading && !hasAudio}
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 disabled:opacity-30"
            title={hasAudio ? (isPlaying ? "暂停" : "播放语音") : "语音生成中..."}
          >
            {ttsLoading && !hasAudio ? (
              <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : isPlaying ? (
              <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function VoiceBubble({
  message,
  girlfriend,
  isPlaying,
  onPlay,
}: {
  message: ChatMessage;
  girlfriend: Girlfriend;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  return (
    <div className="flex items-start gap-2 mb-3">
      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
        <img
          src={girlfriend.avatarUrl}
          alt={girlfriend.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div
        className="bg-white rounded-xl px-4 py-3 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-3 min-w-[140px]"
        onClick={onPlay}
      >
        <button
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isPlaying ? "bg-red-100 text-red-500" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          <div className="flex gap-[2px] items-center h-4">
            {Array.from({ length: 20 }).map((_, i) => {
              const barHeight = isPlaying
                ? 4 + Math.sin(i * 0.5) * 8 + (i * 7 % 6)
                : 3 + (i % 3) * 2;
              return (
                <div
                  key={i}
                  className={`w-[3px] rounded-full transition-all ${
                    isPlaying ? "bg-green-400" : "bg-gray-300"
                  }`}
                  style={{
                    height: `${barHeight}px`,
                    animationDelay: `${i * 50}ms`,
                  }}
                />
              );
            })}
          </div>
          <span className="text-[11px] text-gray-400 mt-0.5 block">语音消息</span>
        </div>
      </div>
    </div>
  );
}

function ImageBubble({
  message,
  girlfriend,
  onView,
}: {
  message: ChatMessage;
  girlfriend: Girlfriend;
  onView: (url: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 mb-3">
      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
        <img
          src={girlfriend.avatarUrl}
          alt={girlfriend.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div
        className="bg-white rounded-xl p-1.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow max-w-[60%]"
        onClick={() => message.imageUrl && onView(message.imageUrl)}
      >
        {message.imageUrl ? (
          <img
            src={message.imageUrl}
            alt="自拍"
            className="rounded-lg max-w-full h-auto object-cover"
            style={{ maxHeight: "300px" }}
          />
        ) : (
          <div className="w-48 h-36 bg-gray-100 rounded-lg flex items-center justify-center">
            <span className="text-gray-400 text-sm">加载中...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SystemBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-center mb-3">
      <span className="text-xs text-gray-400 bg-gray-100/80 px-3 py-1 rounded-full">
        {message.content}
      </span>
    </div>
  );
}

// ===== Main Chat Page =====

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const girlfriendId = params.id as string;
  const girlfriend = getGirlfriend(girlfriendId);

  const [session, setSession] = useState<ChatSession | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [ttsLoadingIds, setTtsLoadingIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 从 D1 恢复会话；失败则新建
  useEffect(() => {
    if (!girlfriend) return;

    let cancelled = false;
    setSessionReady(false);
    setSession(null);

    const boot = async () => {
      const id = getOrCreateDeviceId();
      if (cancelled) return;
      setDeviceId(id);

      const fresh = () => {
        const created = createSession(girlfriend);
        created.avatarUrl = girlfriend.avatarUrl;
        return created;
      };

      try {
        const saved = await loadChatSession({
          deviceId: id,
          girlfriendId: girlfriend.id,
        });
        if (cancelled) return;
        if (saved && Array.isArray(saved.messages) && saved.messages.length > 0) {
          setSession({
            ...saved,
            girlfriendId: girlfriend.id,
            avatarUrl: girlfriend.avatarUrl,
          });
        } else {
          setSession(fresh());
        }
      } catch {
        if (!cancelled) setSession(fresh());
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [girlfriendId, girlfriend]);

  // 会话变更后防抖写入 D1
  useEffect(() => {
    if (!sessionReady || !session || !deviceId || !girlfriend) return;

    const timer = window.setTimeout(() => {
      void saveChatSession({
        deviceId,
        girlfriendId: girlfriend.id,
        session,
      }).catch(() => {
        // 保存失败静默忽略，避免打断聊天
      });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [session, sessionReady, deviceId, girlfriend]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, streamingContent, isLoading]);

  const generateTTS = useCallback(
    async (text: string, messageId: string, autoPlay: boolean = false) => {
      if (!girlfriend) return;
      setTtsLoadingIds((prev) => new Set(prev).add(messageId));
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, speaker: girlfriend.ttsSpeaker }),
        });
        const data = await res.json();
        if (data.audioUri) {
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === messageId
                  ? { ...m, audioUrl: data.audioUri }
                  : m
              ),
            };
          });
          // Auto-play the audio
          if (autoPlay) {
            if (audioRef.current) {
              audioRef.current.pause();
            }
            const audio = new Audio(data.audioUri);
            audio.onended = () => setPlayingAudioId(null);
            audio.onerror = () => setPlayingAudioId(null);
            audio.play().catch(() => {
              // Auto-play may be blocked by browser
            });
            audioRef.current = audio;
            setPlayingAudioId(messageId);
          }
        }
      } catch {
        // TTS failed silently
      } finally {
        setTtsLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    },
    [girlfriend]
  );

  const generateSelfie = useCallback(
    async (
      currentSession: ChatSession,
      options?: { fromPhotoRequest?: boolean }
    ) => {
      if (!girlfriend) return;

      const systemMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        type: "system",
        content: "📸 正在生成自拍...",
        timestamp: Date.now(),
      };

      setSession((prev) => {
        if (!prev) return prev;
        return { ...prev, messages: [...prev.messages, systemMsg] };
      });

      const appendFailureLines = (failHint: string) => {
        const characterLine = options?.fromPhotoRequest
          ? getSelfieFailureCharacterLine(girlfriend.id)
          : null;
        const failTextId = crypto.randomUUID();
        setSession((prev) => {
          if (!prev) return prev;
          const nextMessages = prev.messages.map((m) =>
            m.id === systemMsg.id ? { ...m, content: failHint } : m
          );
          if (characterLine) {
            nextMessages.push({
              id: failTextId,
              role: "girlfriend",
              type: "text",
              content: characterLine,
              timestamp: Date.now(),
            });
          }
          return { ...prev, messages: nextMessages };
        });
        if (characterLine) {
          generateTTS(characterLine, failTextId, true);
        }
      };

      try {
        const { prompt: selfiePrompt } = buildSelfiePrompt({
          girlfriendId: girlfriend.id,
          name: girlfriend.name,
          appearance: girlfriend.appearance,
        });

        const res = await fetch("/api/generate-selfie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: selfiePrompt,
            avatarImageUrl: currentSession.avatarUrl,
          }),
        });
        const data = await res.json();

        if (res.ok && data.imageUrl) {
          const imageMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "girlfriend",
            type: "image",
            content: "给你看看我～",
            imageUrl: data.imageUrl,
            timestamp: Date.now(),
          };
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: [
                ...prev.messages.map((m) =>
                  m.id === systemMsg.id
                    ? { ...m, content: "📸 自拍生成成功！" }
                    : m
                ),
                imageMsg,
              ],
              lastSelfieAt: prev.messageCount,
            };
          });
          generateTTS("给你看看我～", imageMsg.id, true);
        } else {
          const failHint =
            typeof data.error === "string" && data.error.includes("保存")
              ? "📸 图片保存失败，稍后再试"
              : "📸 自拍生成失败，稍后再试";
          appendFailureLines(failHint);
        }
      } catch {
        appendFailureLines("📸 自拍生成失败，稍后再试");
      }
    },
    [girlfriend, generateTTS]
  );

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !girlfriend || !session) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      type: "text",
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    const updatedMessages = [...session.messages, userMessage];
    const newMessageCount = session.messageCount + 1;
    const newIntimacy = Math.min(10, session.intimacy + 0.1);

    // Check if user is requesting a photo - every request should trigger selfie
    const userText = inputText.trim();
    const isPhoto = isPhotoRequest(userText);
    const isRealityMeta = isPhotoRealityMetaQuestion(userText);
    const featureContext = isPhoto
      ? buildSelfiePendingFeatureContext(girlfriend.name)
      : isRealityMeta
        ? buildIdentityHonestyFeatureContext()
        : undefined;

    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: updatedMessages,
        messageCount: newMessageCount,
        intimacy: newIntimacy,
      };
    });
    setInputText("");
    setIsLoading(true);
    setStreamingContent("");

    // Build conversation history for LLM
    const conversationHistory = updatedMessages
      .filter((m) => m.role !== "system" && m.type === "text")
      .slice(-20)
      .map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory,
          systemPrompt: girlfriend.systemPrompt,
          intimacyModifier: getIntimacyModifier(newIntimacy),
          ...(featureContext ? { featureContext } : {}),
        }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            let data: {
              error?: string;
              content?: string;
              done?: boolean;
            };
            try {
              data = JSON.parse(line.slice(6));
            } catch {
              // Skip invalid JSON
              continue;
            }
            if (data.error) {
              throw new Error(data.error);
            }
            if (data.content) {
              accumulatedContent += data.content;
              setStreamingContent(accumulatedContent);
            }
          }
        }
      }

      if (!accumulatedContent.trim()) {
        throw new Error("AI 未返回文字内容，请稍后重试");
      }

      // Create the final message
      const girlfriendMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "girlfriend",
        type: "text",
        content: accumulatedContent,
        timestamp: Date.now(),
      };

      setSession((prev) => {
        if (!prev) return prev;
        const newSession = {
          ...prev,
          messages: [...prev.messages, girlfriendMessage],
        };
        return newSession;
      });
      setStreamingContent("");

      // Generate TTS and auto-play
      generateTTS(accumulatedContent, girlfriendMessage.id, true);

      // Check selfie trigger: by message count OR by user photo request (every time)
      const currentSession: ChatSession = {
        ...session,
        messages: [...session.messages, girlfriendMessage],
        messageCount: newMessageCount,
        intimacy: newIntimacy,
      };

      const shouldSelfie = shouldTriggerSelfie(currentSession) || isPhoto;
      if (shouldSelfie) {
        generateSelfie(currentSession, { fromPhotoRequest: isPhoto });
      }
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message.replace(/^Error:\s*/, "").slice(0, 60)
          : "";
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        type: "system",
        content:
          detail && detail !== "Chat request failed"
            ? `消息发送失败：${detail}`
            : "消息发送失败，请重试",
        timestamp: Date.now(),
      };
      setSession((prev) => {
        if (!prev) return prev;
        return { ...prev, messages: [...prev.messages, errorMessage] };
      });
      setStreamingContent("");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputText, girlfriend, session, generateTTS, generateSelfie]);

  const playAudio = useCallback((audioUrl: string, messageId: string) => {
    if (playingAudioId === messageId) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audio.onended = () => setPlayingAudioId(null);
    audio.onerror = () => setPlayingAudioId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingAudioId(messageId);
  }, [playingAudioId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim()) {
        sendMessage();
      }
    }
  };

  if (!girlfriend) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">角色不存在</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (!sessionReady || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EDE7E0]">
        <p className="text-gray-500 text-sm">正在加载聊天记录...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#EDE7E0]">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.push("/")}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Avatar */}
        <div className="relative">
          <img
            src={girlfriend.avatarUrl}
            alt={girlfriend.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
        </div>

        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-800">
            {girlfriend.name}
          </h2>
          <span className="text-[11px] text-gray-400">
            {session ? `亲密度: ${getIntimacyLevel(session.intimacy)} Lv.${Math.floor(session.intimacy)}` : "连接中..."}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-0">
        {session?.messages.map((message) => {
          if (message.type === "system") {
            return <SystemBubble key={message.id} message={message} />;
          }
          if (message.type === "text") {
            return (
              <TextBubble
                key={message.id}
                message={message}
                girlfriend={girlfriend}
                userAvatarUrl={USER_AVATAR_URL}
                isPlaying={playingAudioId === message.id}
                onPlay={() => {
                  if (message.audioUrl) {
                    playAudio(message.audioUrl, message.id);
                  } else {
                    generateTTS(message.content, message.id, true);
                  }
                }}
                ttsLoading={ttsLoadingIds.has(message.id)}
              />
            );
          }
          if (message.type === "voice") {
            return (
              <VoiceBubble
                key={message.id}
                message={message}
                girlfriend={girlfriend}
                isPlaying={playingAudioId === message.id}
                onPlay={() => message.audioUrl && playAudio(message.audioUrl, message.id)}
              />
            );
          }
          if (message.type === "image") {
            return <ImageBubble key={message.id} message={message} girlfriend={girlfriend} onView={setViewingImage} />;
          }
          return null;
        })}

        {/* Streaming content */}
        {streamingContent && (
          <div className="flex items-start gap-2 mb-3">
            <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
              <img
                src={girlfriend.avatarUrl}
                alt={girlfriend.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="max-w-[75%] bg-white text-gray-800 rounded-xl px-4 py-2.5 shadow-sm text-[15px] leading-relaxed">
              {streamingContent}
              <span className="inline-block w-0.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isLoading && !streamingContent && <TypingIndicator girlfriend={girlfriend} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - always enabled；相对层级高于页面内容，避免被同层装饰盖住 */}
      <div className="relative z-20 bg-white/90 backdrop-blur-sm border-t border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent transition-all"
          />
          <button
            type="button"
            aria-label="发送"
            onClick={sendMessage}
            disabled={!inputText.trim()}
            className="relative z-20 w-10 h-10 shrink-0 rounded-full bg-[#95EC69] flex items-center justify-center hover:bg-[#7ED94E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <img
            src={viewingImage}
            alt="查看大图"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            onClick={() => setViewingImage(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
