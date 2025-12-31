# 🌊 MarkFlow

**不仅仅是高亮工具，更是你的网页内容导航仪。**

[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-orange)](https://addons.mozilla.org/zh-CN/firefox/addon/highlight-mark-flow/) ![Local First](https://img.shields.io/badge/Storage-Local--Only-blue) ![Privacy](https://img.shields.io/badge/Privacy-No--Login-green)

---

## 🚀 为什么选择 MarkFlow?

大多数标注工具只管“画线”，但 MarkFlow 关注的是“回顾与索引”。我们将碎片化的网页标记转化为**结构化的知识大纲**，让长文阅读从“迷失滚动”变为“精准跳转”。

![MarkFlow](./assets/Highlight-Mark-Flow_4.gif '系统界面预览')

### ✨ 核心亮点

- **📍 书签式精准跳转**：每一处高亮都是一个“锚点”。通过侧边栏点击笔记，瞬间回跳原文位置，找回上下文。
- **📂 自动大纲构建**：智能识别网页 H1-H6 标题，将你的笔记按章节自动归类，线性碎片瞬间变成逻辑图谱。
- **⚡ 极速标注流**：按住 `Alt` 键拖拽即可标记，配合 `Alt + S` 快速保存，交互如呼吸般自然。
- **🛠️ 深度兼容性**：支持 **Shadow DOM**（适配 Bilibili 评论区、复杂 Web App），具备专业级的网页兼容能力。
- **🔐 隐私至上**：100% 本地存储，无需注册，不采集数据，支持一键导出 Markdown 至 Obsidian/Notion。

---

## 🛠️ 核心功能

| 功能                     | 描述                                                     |
| :----------------------- | :------------------------------------------------------- |
| **知识浮岛 (SidePanel)** | 侧边栏常驻管理，支持搜索、筛选和一键跳转。               |
| **快捷黑名单**           | Popup 弹窗一键开关，支持“软提示”刷新，不中断当前工作流。 |
| **多色管理**             | 预设多种高亮色彩，支持自定义颜色与标签分类。             |
| **Markdown 导出**        | 将你的阅读心得一键转化为精美文档。                       |

---

## 📖 快速上手

### 1. 开启标记

按住 **`Alt`** (macOS 为 `Option`) 的同时选中文字，即可唤起高亮工具栏。

### 2. 结构化回顾

点击浏览器图标开启 **SidePanel (知识浮岛)**。你会看到标记已按文章章节自动排版。

### 3. 精准回跳

在侧边栏点击任意笔记，页面将自动滚动至对应位置并闪烁提示。

---

## 🛠️ 开发者与技术细节

MarkFlow 采用轻量且健壮的架构开发：

- **混合通信**：使用 `webext-bridge` (Options 上下文伪装) 确保侧边栏连接持久稳定。
- **数据净化**：采用 Vue 3 `toRaw` 处理，确保跨上下文传输的安全性。
- **高效适配**：深度适配 Shadow DOM 选区逻辑。

---

## 📄 开源说明

本项目遵循 MIT 协议。欢迎提交 Issue 或 Pull Request 来完善 MarkFlow。

_“让每一处高亮都有迹可循。”_
