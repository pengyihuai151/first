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
│   ├── App.tsx          # 主应用组件
│   ├── main.tsx         # 入口文件
│   ├── components/      # UI 组件
│   ├── constants/       # 常量定义
│   ├── lib/             # 工具库
│   └── types.ts         # 类型定义
├── scripts/             # 构建与预览脚本
│   ├── coze-preview-build.sh  # 预览构建
│   ├── coze-preview-run.sh    # 预览运行
│   ├── build.sh         # 部署构建
│   └── run.sh           # 部署运行
├── index.html           # HTML 入口
├── vite.config.ts       # Vite 配置
├── tsconfig.json        # TypeScript 配置
├── package.json
└── .coze               # Coze 项目配置
```

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
