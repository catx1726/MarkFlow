# MarkFlow

> 一款能够精准跳转的网页文本标记工具，支持 GitHub Gist 多端同步。

[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-orange)](https://addons.mozilla.org/zh-CN/firefox/addon/markflow/) [![GitHub License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE) ![Local First](https://img.shields.io/badge/Storage-Local--First-blue) ![Sync](https://img.shields.io/badge/Sync-GitHub%20Gist-purple) ![Privacy](https://img.shields.io/badge/Privacy-No--Login-green)

---

## 它能做什么？

### 📍 精准跳转

在网页上按住 `Alt` 划词标记，点击侧边栏笔记，瞬间回跳原文位置。

### 🏷️ 结构化整理

标记自动按章节归类，打上标签后跨网页构建知识图谱。

### 🛠️ 自适应恢复

页面结构漂移或容器复用？系统会尝试自动修复。若内容发生实质性增删或布局重构，也会在侧边栏保留上下文供你确认。

### 🔄 多端同步（可选）

通过 GitHub Gist 在多台设备间同步标记。

![MarkFlow Preview](./assets/Highlight-Mark-Flow_4.gif)

---

## 快速开始

1. **安装扩展** — [Firefox 商店](https://addons.mozilla.org/zh-CN/firefox/addon/markflow/)（Chrome 即将上线）
2. **打开任意网页**，按住 `Alt` 选中文本
3. **点击侧边栏标记**，瞬间跳回原文
4. **（可选）多端同步** — 在设置页配置 GitHub Token，连接并开启同步

---

## 常见问题

**Q: 高亮在动态页面（如 Bilibili/Reddit）会丢失吗？**  
A: 页面结构漂移、容器复用等常见场景下，系统会尝试自动恢复。若页面内容发生实质性增删或布局重构，可能无法自动恢复，此时会在侧边栏保留上下文供你确认。

**Q: 数据存储在哪里？**  
A: 默认 100% 本地存储，无需注册，不采集任何数据。可选开启 GitHub Gist 同步。

**Q: 可以导出笔记吗？**  
A: 支持一键导出 Markdown，可直接粘贴到 Obsidian/Notion。

**Q: 为什么偶尔会弹出确认恢复的弹窗？**  
A: 当网页内容发生大段删减或布局重构时，系统可能无法自动恢复，会在侧边栏保留上下文提示你。你可以根据上下文决定是否重新标记。

**Q: 多端同步安全吗？**  
A: 同步使用 GitHub Gist，插件仅需 `gist` 权限，无法访问你的代码仓库。Token 存储在扩展私有空间中。

---

## 技术细节

对恢复算法、同步机制和工程实现感兴趣？→ [技术文档](./docs/TECHNICAL.md)

---

MIT License

> _让每一处高亮都有迹可循。_
