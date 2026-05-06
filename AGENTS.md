## 项目概述
React + Vite + TypeScript + Tailwind CSS Web 应用，公考备考助手。

## 技术栈
- **框架**：React 19 + Vite 6
- **语言**：TypeScript 5.8
- **样式**：Tailwind CSS 4
- **AI 服务**：智谱 GLM-4-Flash（国内稳定，免费额度大）
- **包管理器**：pnpm
- **Node 运行时**：nodejs-24

## 目录结构
```
/workspace/projects
├── src/
│   ├── App.tsx          # 主应用组件（5 Tab 导航）
│   ├── main.tsx         # 入口文件
│   ├── components/
│   │   ├── Dashboard.tsx      # 总览页
│   │   ├── StudyRoom.tsx      # 学习计划+计时
│   │   ├── WrongQuestionBank.tsx  # 错题录入（无图片）
│   │   ├── AnalysisPage.tsx   # 学情分析（考试+错题综合）
│   │   ├── AIAssistant.tsx    # AI 智能建议
│   │   ├── ExamBank.tsx       # 考试录入（设置页跳转）
│   │   ├── NotesSection.tsx   # 笔记管理（设置页跳转）
│   │   ├── QuotesManager.tsx  # 箴言管理
│   │   └── SettingsPage.tsx   # 设置页
│   ├── constants/
│   ├── lib/
│   │   ├── ai.ts        # AI 服务（智谱 GLM-4-Flash）
│   │   ├── storage.ts   # IndexedDB 存储
│   │   └── utils.ts
│   └── types.ts
├── scripts/
├── index.html
├── vite.config.ts
└── .coze
```

## 导航结构
5 个主 Tab：总览 / 计划 / 错题 / 分析 / 设置
- 设置页提供考试录入、笔记管理快捷入口
- 已砍掉错题复盘功能（ReviewSession 已删除）

## 关键入口
- **开发**：`pnpm run dev`（端口 3000）
- **构建**：`pnpm run build`
- **预览**：`pnpm run preview`

## 运行与预览
1. 安装依赖：`pnpm install`
2. 配置环境变量：设置 `.env.local` 中的 `GEMINI_API_KEY`
3. 启动开发：`pnpm run dev`

## Coze 初始化配置

### .coze 配置摘要
- **sub_id**：`dc62e148`
- **project_type**：`web`
- **preview_enable**：`enabled`
- **deploy.kind**：`service`
- **deploy.flavor**：`web`
- **entrypoint**：`index.html`
- **requires**：`["nodejs-24"]`

### Preview 脚本
- **build**：`scripts/coze-preview-build.sh` → `pnpm install`
- **run**：`scripts/coze-preview-run.sh` → `vite --host 0.0.0.0 --port 5000`
- **端口**：5000

### Deploy 脚本
- **build**：`scripts/build.sh` → `pnpm install && pnpm vite build`
- **run**：`scripts/run.sh` → `npx serve dist -l 5000`
- **端口**：5000

## 环境变量
- `VITE_AI_API_KEY`：智谱 AI API 密钥
- `VITE_AI_BASE_URL`：AI API 地址（默认智谱）
- `VITE_AI_MODEL`：模型名称（默认 glm-4-flash）

## AI 配置指南
1. 注册智谱 AI：https://open.bigmodel.cn
2. 进入控制台 → API Keys → 创建新密钥
3. 将密钥填入 `.env.local` 的 `VITE_AI_API_KEY`
4. 重启开发服务器

## 用户偏好与长期约束
- Node.js 项目统一使用 pnpm 管理依赖
- Web 项目默认暴露 5000 端口预览
- 技术项目根目录与工作区根目录重合（`path = "."`）
- 预览链路采用 Vite dev server 直接提供前端服务
- 部署链路采用 Vite build + npx serve 提供静态产物
- 计时功能：切换页面时计时状态保存到 localStorage，可选择继续或放弃
- 错题录入不使用图片，使用错误原因快捷选择（10 个预设原因）
- AI 所有对话都传完整学习数据（包括错误原因统计）
- 错题复盘功能已移除，分析页整合考试+错题综合分析
