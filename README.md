# 纸片女友（Cursor 本地版）

基于 Next.js 16 + React 19 的虚拟恋爱聊天应用。本仓库为从扣子编程导出后，在本地接入**火山方舟**的版本（仓库名：`zhipiannvyou-cursor`）。

## 功能

- 四位预设 AI 女友角色选择与聊天
- 文字对话：火山方舟 LLM（流式 SSE）
- 自拍/头像图：火山方舟 Seedream
- 语音 TTS：仍可走扣子 SDK（可选，需单独配置）

## 环境要求

- Node.js 24+
- pnpm 9+

## 快速开始

```bash
pnpm install
cp .env.example .env.local
# 编辑 .env.local，填写火山方舟配置
```

### 必填环境变量

| 变量 | 说明 |
|---|---|
| `ARK_API_KEY` | 火山方舟 API Key |
| `ARK_SEEDREAM_MODEL` | 图片模型接入点（`ep-m-...`） |
| `ARK_LLM_MODEL` | 文字模型接入点（`ep-m-...`） |

接入点在 [火山方舟控制台 → 在线推理](https://console.volcengine.com/ark) 中复制。

### 启动

macOS 上 5000 端口常被系统占用，默认使用 **3000**：

```bash
COZE_PROJECT_ENV=DEV PORT=3000 pnpm tsx watch src/server.ts
```

或：

```bash
pnpm next dev -p 3000
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

> 勿将 `.env.local` 提交到 Git。

## 技术栈

- Next.js 16 (App Router) / React 19 / TypeScript
- Tailwind CSS 4 + shadcn/ui
- 火山方舟（对话 + Seedream 图片）

## 目录结构

```
src/
├── app/
│   ├── page.tsx              # 角色选择
│   ├── chat/[id]/page.tsx    # 聊天页
│   └── api/
│       ├── chat/             # 文字对话
│       ├── tts/              # 语音（扣子，可选）
│       ├── generate-avatar/
│       └── generate-selfie/
└── lib/
    ├── girlfriends.ts
    ├── ark-llm.ts
    └── ark-seedream.ts
```
