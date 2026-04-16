# 🌊 MarkFlow

**More than a highlighter, it's your web content navigator.** **不仅仅是划词高亮，更是你的网页内容导航仪。**

[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-orange)](https://addons.mozilla.org/zh-CN/firefox/addon/markflow/) [![GitHub License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE) ![Local First](https://img.shields.io/badge/Storage-Local--Only-blue) ![Privacy](https://img.shields.io/badge/Privacy-No--Login-green)

---

## 🚀 Why MarkFlow? / 为什么选择 MarkFlow?

大多数标注工具只管“画线”，但 MarkFlow 关注的是 **“回顾与索引”** 。我们将碎片化的网页标记转化为**结构化的知识大纲**，让长文阅读从“迷失滚动”变为“精准跳转”。

![MarkFlow Preview](./assets/Highlight-Mark-Flow_4.gif '系统界面预览')

### ✨ 核心亮点

- **📍 书签式精准跳转**: 每一处高亮都是一个“锚点”。通过侧边栏点击笔记，瞬间回跳原文位置。
- **📂 自动大纲构建**: 智能识别网页 H1-H6 标题，将你的**标记**按章节自动归类。
- **🌐 跨元素无缝恢复**: 高亮可跨越多个 `<p>`、`<div>` 或列表项，确保长文本段落完整性。
- **🛠️ 标记进化 (Self-healing)**: **当页面内容变动时，只需确认一次，系统会自动学习并适配最新的页面结构，后续即可实现无感恢复，不再反复弹窗。**
- **⚡ 呼吸感交互**: 按住 `Alt` 键拖拽即可高亮，彻底杜绝误触。
- **🔐 隐私至上**: 100% 本地存储，无需注册，不采集数据，支持一键导出 Markdown 至 Obsidian/Notion。

---

## 🛠️ 常见问题 (FAQ)

**Q: 为什么偶尔会弹出确认恢复的弹窗？** A: 这是系统的“自愈逻辑”。当网页内容发生了大段删减或布局重构，系统为了确保万无一失，会请求你进行一次手动确认。**你只需要确认这一次**，系统就会学习到页面的新结构，下次刷新时将直接无感恢复。

**Q: 我的高亮在哔哩哔哩/Reddit 等动态页面会丢失吗？** A: 不会。MarkFlow 内置了“全局搜索回退”和“智能冷却”机制，即使评论在滚动时发生漂移或容器复用，系统也能自动找回你的标记。

---

## 🏗️ 技术实现 (Technical Deep Dive)

MarkFlow 放弃了脆弱的单点索引，采用了 **“多维锚点共识 (Consensus Anchoring)”** 与 **“局部双端对齐 (Local Alignment)”** 算法。

### 核心流程：

1.  **指纹采样**: 高亮创建时，提取多个特征锚点，记录其相对于高亮中心的物理位移。
2.  **共识搜索**: 即使部分内容消失，只要有足够比例的锚点达成“空间位置共识”，系统即可锁定高亮区域（簇心）。
3.  **结果对齐**: 算法选择综合得分最高的片段作为高亮。即便中间文字被删减，系统也能智能逼近最优边界。

### 四级恢复架构 (Restoration Flow)

| 层级          | 名称         | 逻辑                 | 自动恢复门槛          | 目的                         |
| :------------ | :----------- | :------------------- | :-------------------- | :--------------------------- |
| **Level 1**   | **路径还原** | Rangy 序列化路径还原 | 相似度 > 95%          | 极速无感恢复，性能最优       |
| **Level 2**   | **内容对齐** | 局部/正则精确搜索    | 唯一项且相似度 100%   | 元素位置漂移，但内容未变     |
| **Level 2.5** | **全局回退** | 全文档回退搜索       | 唯一项且相似度 100%   | 解决虚拟列表导致的容器复用   |
| **Level 3**   | **共识重构** | Consensus Search     | 唯一项且相似度 >= 75% | 内容微调场景（文字被增删）   |
| **Level 4**   | **歧义消除** | Disambiguation UI    | 用户手动交互          | 最终兜底，由用户进行物理校准 |

### 极端环境适配 (Bilibili/Reddit/X)

- **3s 恢复冷却**: 当全局搜索失败时，该标记进入 3 秒静默期，防止虚拟列表滚动时的循环重试。
- **正则模糊匹配**: 搜索算法自动忽略 `\n`、多空格及零宽不可见字符，穿透碎片化的文本节点。
- **迭代式 DOM 遍历**: 放弃递归改用“栈”遍历，轻松处理超大 DOM 结构。

---

## 📄 开源说明

本项目遵循 MIT 协议。欢迎提交 Issue 或 Pull Request 来完善 MarkFlow。

> _“让每一处高亮都有迹可循。” / "Make every highlight traceable."_
