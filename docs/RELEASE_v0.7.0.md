# MarkFlow v0.7.0 发布说明

**发布日期**: 2026-06-05

---

### 🛡️ 稳定性提升

- **修复存储竞态条件** (#45)：极端场景下并发写入可能导致数据覆盖，现已通过 `ensureReady` 守卫 + 超时拒绝机制彻底解决。
- **Schema 一致性保障**：优化 `mergeDefaults` 策略，确保关键数据结构在版本升级时自动补齐缺失字段。

### 🏗️ Sidepanel 架构重构

- **全面模块化** (#47)：将 800+ 行的 `Sidepanel.vue` 拆分为 5 个 Composables 和 5 个独立组件：
  - `useSidepanelData` — 数据获取与 TagTree 构建
  - `useMarkActions` — 标记跳转、删除、复制、笔记
  - `useTagActions` — 标签创建、关联、颜色管理
  - `useUIState` — UI 状态与交互逻辑
  - `TagFolder.vue` / `PageSection.vue` / `MarkItem.vue` 等可复用组件
- 重构后测试覆盖率显著提升，Sidepanel 逻辑更易于维护与迭代。

### ☁️ GitHub Gist 同步

- **双向同步** (#41)：支持将本地标记数据同步到 GitHub Gist，并在多台设备间拉取合并。
- **无死锁设计**：引入 `isSyncing` 标志位 + 统一写入队列 (`enqueueWrite`)，彻底消除同步过程中的竞态风险。
- **墓碑机制**：删除的标记以墓碑形式保留，同步时正确传播删除状态，避免已删数据"复活"。

### ✨ UI / UX 全面升级

- **StorageManager 全新交互**：底部存储面板支持展开/折叠，CSS Grid 动画过渡，实时显示配额使用百分比。
- **Popup 品牌感优化**：主操作按钮改用品牌蓝色，新增 SVG Logo，视觉层次更清晰。
- **DisambiguationModal 暗黑模式**：搜索框、候选列表、底部面板全面适配暗黑主题。
- **滚动条彻底修复**：解决 Firefox 白色滚动条、布局抖动等问题；6px 细滚动条 + CSS 变量集中管理颜色。
- **空状态与布局稳定性**：Empty state 根据 StorageManager 展开状态动态调整底部留白，不再强制撑满屏幕。
- **设置按钮 reposition**：从绝对定位改为 Header 行内弹性布局，长列表时始终可访问。
- **代码清理**：删除未使用的 `Prompt.vue`，减少维护负担。

### 📊 可观测性增强

- **高亮恢复失败统计**：采集恢复失败的 URL 与原因，辅助持续优化搜索算法。
- **存储配额监控**：实时监控本地存储占用率，预防容量不足导致的崩溃。
- **同步 Payload 预警**：监控 Gist 同步数据体积，超限前主动告警。

### 📝 文档与品牌

- **README 重写**：定位更聚焦 —— "一款能够精准跳转的网页文本标记工具"。
- **Landing Page 同步**：`docs/index.html` 标题、描述、Hero 区域与 README 统一。

---

## 安装与升级

| 平台 | 下载 |
|------|------|
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/markflow/) |
| Chrome / Edge | [extension-chromium.zip](https://github.com/catx1726/MarkFlow/releases/download/v0.7.0/extension-chromium.zip) |
| 全部版本 | [GitHub Releases](https://github.com/catx1726/MarkFlow/releases/) |

---

**Full Changelog**: [v0.6.0...v0.7.0](https://github.com/catx1726/MarkFlow/compare/v0.6.0...v0.7.0)
