# 📝 Origamicmic Furi

> 日语歌词自动注音工具 —— 搜索、粘贴、注音、编辑、导出，一站式解决。

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="version">
  <img src="https://img.shields.io/badge/next-16.2-black" alt="next.js">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
</p>

## ✨ 功能
- 🇯🇵 **自动注音** — Kuromoji + Kuroshiro 引擎，汉字转平假名或罗马音
- 🟠 **高亮对照** — 原文和注音两侧同步高亮，汉字与读音一一对应
- ✏️ **在线编辑** — 点击汉字即可修改读音，提交修正供社区投票
- 📤 **多种导出** — TXT（原文+注音）、TXT（仅注音）、LRC（带时间戳时可用）


## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装运行

```bash
git clone https://github.com/origamicmic/origamicmic-furi.git
cd origamicmic-furi
npm install
npm run dev
```

### 部署至 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/origamicmic/origamicmic-furi)

或手动步骤：

1. 在 [vercel.com](https://vercel.com) 注册并导入 GitHub 仓库
2. 在 Vercel 项目 Settings → Environment Variables 中添加 `.env.local` 中的变量
3. 点击 Deploy，Vercel 自动检测 Next.js 项目并完成部署

### 环境变量

复制 `.env.example` 为 `.env.local`，按需填写：

```bash
# 可选：Genius API token，用于扩展搜索结果
# 在 https://genius.com/api-clients 申请
GENIUS_ACCESS_TOKEN=你的token

# 可选：Supabase 数据库，用于社区推荐与投票功能
NEXT_PUBLIC_SUPABASE_URL=你的supabase地址
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的supabase密钥
```

所有外部服务均为可选，不配置也能正常运行。

## 🏗️ 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16 (App Router + Turbopack) |
| UI | React 19、Tailwind CSS v4、Base UI |
| 日语 NLP | Kuroshiro + Kuromoji |
| 图标 | Lucide React |
| 数据库 | Supabase（可选） |
| 字体 | Geist |

## 📂 项目结构

```
src/
├── app/            # Next.js 页面与 API 路由
│   └── api/        # 搜索、歌词、音频、推荐、投票接口
├── components/
│   ├── editor/     # 编辑面板、单词编辑器
│   ├── export/     # 导出按钮与格式处理
│   ├── layout/     # 顶栏、播放器、主题提供者
│   ├── lyrics/     # 原文面板、注音面板
│   ├── search/     # 搜索框、模式选择、粘贴输入
│   └── ui/         # 基础 UI 组件
├── hooks/          # 自定义 React hooks
├── lib/
│   ├── lyrics-sources/  # 歌词源适配器（网易云、Genius、Lyrics.ovh）
│   ├── furigana.ts      # 日语引擎初始化、分词、转换
│   ├── export.ts        # 导出功能
│   └── supabase.ts      # Supabase 客户端
└── types/          # TypeScript 类型定义
```

## 🎛️ 开发

```bash
npm run dev      # 开发模式（Turbopack）
npm run build    # 生产构建
npm run lint     # 代码检查
```

## 👤 作者

**Origamicmic** — [github.com/origamicmic](https://github.com/origamicmic)

## 📄 许可证

MIT
