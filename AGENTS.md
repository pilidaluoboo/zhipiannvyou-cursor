# 项目上下文

## 项目概述
纸片女友 - 一款虚拟恋爱模拟聊天游戏，用户可与四位预设的AI女友进行真实感聊天。

## 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **AI SDK**: coze-coding-dev-sdk

## 目录结构

```
├── public/                 # 静态资源
├── src/
│   ├── app/
│   │   ├── page.tsx        # 角色选择首页
│   │   ├── layout.tsx      # 根布局
│   │   ├── globals.css     # 全局样式
│   │   ├── chat/[id]/
│   │   │   └── page.tsx    # 聊天页面 (核心)
│   │   └── api/
│   │       ├── chat/route.ts         # LLM流式聊天API
│   │       ├── tts/route.ts          # TTS语音合成API
│   │       ├── generate-avatar/route.ts  # 头像生成API
│   │       └── generate-selfie/route.ts  # 自拍生成API
│   ├── components/ui/      # Shadcn UI 组件库
│   └── lib/
│       ├── girlfriends.ts  # 四位女友角色配置数据
│       ├── chat-session.ts # 聊天会话管理工具
│       └── utils.ts        # 通用工具函数
├── DESIGN.md               # 设计规范
└── package.json
```

## 核心功能模块

### 角色系统 (girlfriends.ts)
- 4位预设女友: 小柠(活泼)、雅琪(温柔)、樱子(傲娇)、冰心(冷静)
- 每位角色有独立的人格设定、TTS声线、头像/自拍提示词、配色方案
- TTS声线映射: 小柠→可爱女声、雅琪→知性灿灿、樱子→调皮公主、冰心→流畅女声

### 聊天系统 (chat/[id]/page.tsx)
- 微信风格UI: 消息气泡、语音播放、图片查看
- SSE流式输出: 用户发送消息后通过ReadableStream实时接收AI回复
- 亲密度系统: 0-10级，影响AI回复的亲密程度
- 自拍触发: 约每8-12条消息触发一次自拍生成
- 语音合成: 每条文字回复后自动生成TTS语音

### API路由
- `/api/chat` - POST, SSE流式返回LLM回复，使用doubao-seed-2-0-lite模型
- `/api/tts` - POST, 传入text和speaker参数，返回audioUri
- `/api/generate-avatar` - POST, 传入prompt生成角色头像
- `/api/generate-selfie` - POST, 传入prompt和可选的avatarImageUrl生成自拍

## 开发规范

### 编码规范
- TypeScript strict模式，禁止隐式any
- 禁止在JSX渲染逻辑中直接使用Math.random()等不纯函数
- 使用'use client'标记客户端组件

### 集成SDK
- coze-coding-dev-sdk仅在服务端代码中使用
- 所有API路由需使用HeaderUtils.extractForwardHeaders转发请求头
- LLM使用stream()方法实现流式输出
- 图片生成使用doubao-seedream-5-0-260128模型
- TTS使用角色对应的speaker ID

## 包管理规范
仅允许使用 pnpm 作为包管理器
