"use client";

import { GIRLFRIENDS } from "@/lib/girlfriends";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

export default function HomePage() {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [welcomeEmail, setWelcomeEmail] = useState("");
  const [welcomeStatus, setWelcomeStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  const handleStartChat = useCallback((gfId: string) => {
    router.push(`/chat/${gfId}`);
  }, [router]);

  const handleSendWelcome = useCallback(async () => {
    const email = welcomeEmail.trim();
    if (!email) {
      setWelcomeStatus("error");
      setWelcomeMessage("请先填写邮箱");
      return;
    }

    setWelcomeStatus("loading");
    setWelcomeMessage("");
    try {
      const res = await fetch("/api/email/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWelcomeStatus("error");
        setWelcomeMessage(data.error || "发送失败");
        return;
      }
      setWelcomeStatus("ok");
      setWelcomeMessage("欢迎邮件已发送，请查收邮箱（含垃圾箱）");
    } catch {
      setWelcomeStatus("error");
      setWelcomeMessage("网络错误，请稍后重试");
    }
  }, [welcomeEmail]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-amber-50 to-purple-50 flex flex-col items-center justify-center p-4">
      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-800 mb-3 tracking-wide">
          纸片女友
        </h1>
        <p className="text-gray-500 text-base">
          选择你想要聊天的女友，开始甜蜜对话
        </p>
      </div>

      {/* Girlfriend Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl w-full">
        {GIRLFRIENDS.map((gf) => (
          <div
            key={gf.id}
            className={`
              relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 ease-out
              bg-gradient-to-br ${gf.bgGradient}
              ${hoveredId === gf.id ? "scale-105 shadow-xl -translate-y-1" : "scale-100 shadow-md"}
            `}
            onMouseEnter={() => setHoveredId(gf.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => handleStartChat(gf.id)}
          >
            <div className="p-5 flex flex-col items-center text-center">
              {/* Avatar - use pre-generated static image */}
              <div className="w-20 h-20 rounded-full mb-3 shadow-inner overflow-hidden bg-white/50">
                <img
                  src={gf.avatarUrl}
                  alt={gf.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Name & Age */}
              <h2 className="text-lg font-bold text-gray-800">
                {gf.name}
              </h2>
              <span className="text-xs text-gray-500 mb-2">
                {gf.age}岁
              </span>

              {/* Personality Tags */}
              <div className="flex flex-wrap gap-1.5 justify-center mb-3">
                {gf.personality.split("、").map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${gf.color}20`,
                      color: gf.color,
                      fontWeight: 600,
                      filter: "brightness(0.7) saturate(1.2)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Greeting Preview */}
              <p className="text-sm text-gray-600 italic leading-relaxed">
                &ldquo;{gf.greeting}&rdquo;
              </p>

              {/* Voice Style */}
              <div className="mt-3 text-xs text-gray-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L10 6.087l-3.763 1.495 1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                </svg>
                {gf.voiceStyle}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 欢迎邮件测试（写死模板） */}
      <div className="mt-10 w-full max-w-md rounded-2xl bg-white/70 backdrop-blur-sm border border-white/80 p-4 shadow-sm">
        <p className="text-sm font-medium text-gray-700 mb-1">测试欢迎邮件</p>
        <p className="text-xs text-gray-500 mb-3">
          输入你的邮箱，发送一封写死模板的雅琪欢迎信（仅测试）
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={welcomeEmail}
            onChange={(e) => setWelcomeEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
          />
          <button
            type="button"
            onClick={handleSendWelcome}
            disabled={welcomeStatus === "loading"}
            className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {welcomeStatus === "loading" ? "发送中…" : "发送"}
          </button>
        </div>
        {welcomeMessage ? (
          <p
            className={`mt-2 text-xs ${
              welcomeStatus === "ok" ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {welcomeMessage}
          </p>
        ) : null}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400 mt-8">
        所有角色均为虚拟AI，对话内容健康合规
      </p>
    </div>
  );
}
