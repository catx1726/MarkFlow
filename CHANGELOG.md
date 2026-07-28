# Unreleased

# Released

## [v0.7.2] - 2026-07-28

### [2026-07-28] fix(tooltip): 阻止创建标签按钮的 mouseup 冒泡关闭 tooltip (#56)
fix(tooltip): 阻止创建标签按钮的 mouseup 冒泡关闭 tooltip

### [2026-07-28] feat(content): 记忆上次使用的标签，新建标记默认预选 (#54) (#55)
feat(content): 记忆上次使用的标签，新建标记默认预选 (#54)

### [2026-07-04] feat(sidepanel): add search with context preservation and compact mode (#52) (#53)
feat(sidepanel): add search with context preservation and compact mode (#52)

## [v0.7.1] - 2026-07-03

### 🛡️ 稳定性

- **Fix**: 修复首次连接 GitHub Gist 时覆盖远程数据的问题 (#51)。现在会先拉取并合并远程数据，再启用自动同步。
- **Fix**: 使用 `getGistById` 获取完整 Gist 内容，避免 `/gists` 列表接口缺失文件内容。
- **Fix**: 重构同步队列，拆出 `performPullInternal`，消除错误恢复路径中的嵌套队列死锁风险。
- **Fix**: 增加错误恢复冷却期与 `canPush` 守卫，防止失败后重复推送覆盖远程。
- **Fix**: MV3 Service Worker 兼容：`triggerPull` 增加 `webext-bridge` 超时回退到原生消息。
- **Fix**: Popup 直接调用 `chrome.sidePanel.open`，保留用户手势，避免侧边栏打不开。
- **Fix**: CSP 合规：内联主题脚本抽离为外部模块。
- **Fix**: Background 中防护 `window` 和 `chrome` 访问，提升 MV3 稳定性。

### ✨ 功能

- **Feat**: 新增"高亮行高"设置项，修改后实时广播刷新所有页面高亮。
- **Feat**: Sidepanel 展示恢复失败的原文上下文提示。
- **Feat**: Options 页面新增粘性侧边栏导航、Scroll Spy 和保存反馈。

### 🏗️ 架构

- **Refactor**: 简化恢复策略，跳过 Level 3/4 路径与歧义弹窗，标记失败时写入 `restoreFailedAt`。

### 📝 文档

- **Docs**: 更新 README、Landing Page、TECHNICAL.md，明确当前自动恢复层级为 Level 1/2/2.5，Level 3/4 已跳过。
- **Docs**: 修正同步架构文档中"加密存储"为"私有存储"，补全 `enqueueSync` 返回值，精确描述 LWW 合并策略。

## [v0.7.0] - 2026-06-05

### 🛡️ 稳定性

- **Fix**: 修复存储竞态条件，防止极端场景下的数据覆盖与丢失 (#45)。
- **Fix**: 为 `ensureReady` 守卫增加超时拒绝机制，避免死锁。
- **Fix**: 优化 `mergeDefaults` 策略，确保关键数据结构的 schema 一致性。

### 🏗️ 架构重构

- **Refactor**: Sidepanel 模块化重构 (#47)。将 800+ 行的单文件拆分为 5 个 Composables (`useSidepanelData`, `useMarkActions`, `useTagActions`, `useUIState` 等) 和 5 个组件，大幅提升可维护性与测试覆盖率。
- **Feat**: 集成 `refreshAllMarks` 到 `useSidepanelData`，生命周期更安全。

### ☁️ GitHub Gist 同步

- **Feat**: 实现 GitHub Gist 双向同步 (#41)。支持拉取、推送、增量合并。
- **Feat**: 引入墓碑机制 (tombstoning) 与统一写入队列，彻底消除同步死锁风险。
- **Feat**: 增加 Token 过期处理与重试逻辑。

### ✨ UI / UX

- **Feat**: StorageManager 全新交互 —— 支持展开/折叠，带动画过渡，实时显示存储配额百分比。
- **Feat**: Popup 视觉升级 —— 主操作按钮使用品牌蓝色，增加 SVG Logo，提升品牌辨识度。
- **Fix**: DisambiguationModal 完整适配暗黑模式。
- **Fix**: 彻底解决滚动条导致的布局抖动问题（WebKit + Firefox 双兼容）。
- **Fix**: 自定义细滚动条（6px）全局统一，颜色抽取为 CSS 变量。
- **Fix**: 空状态居中策略优化，不再强制撑满高度。
- **Fix**: 设置按钮从绝对定位改为行内弹性布局，避免长列表时无法访问。
- **Chore**: 清理未使用的 `Prompt.vue` 组件，减少维护负担。

### 📊 可观测性

- **Feat**: 高亮恢复失败统计 —— 采集失败 URL 与原因，辅助优化搜索算法。
- **Feat**: 本地存储配额监控 —— 实时追踪占用率，预防极端崩溃。
- **Feat**: 同步 Payload 大小预警 —— 实时监控 Gist 同步数据体积。

### 📝 文档

- **Docs**: 重写 README，定位更聚焦："一款能够精准跳转的网页文本标记工具"。
- **Docs**: Landing Page (`docs/index.html`) 文案与视觉同步更新。
- **Docs**: 新增 `NIT_ROADMAP.md`，汇总后续迭代建议。

---

## [v0.6.0] - 2026-05-22

- **Feat**: 内容关联与侧边栏三级架构 (标签 -> 网页 -> 标记) (#33, #37).
- **Feat**: 侧边栏手风琴式折叠、互斥展开与数量徽标 (#38, #39, #40).
- **Feat**: 优化 Markdown 导出 (平铺标题层级，更好的嵌入体验).
- **Feat**: 页面按最近活跃排序，标记按文档位置排序 (#35).
- **Fix**: 错误收集范围过滤 (仅限扩展错误) (#34, #36).
- **Fix**: 修复知乎等页面的恢复问题 (两阶段恢复与防抖弹窗).
- **Fix**: 侧边栏圆角恢复、模板嵌套错误修复及术语统一.


### [2026-04-16] Error Collection & Export

- **Feat**: Implement unified error collection (`ErrorCollector`) to intercept and store runtime errors and unhandled rejections from background and content scripts.
- **Feat**: Add "Export Error Logs" functionality in Options page for manual feedback reporting.

### [2026-04-15] Robustness & Performance Update

- **Fix**: Resolved restoration performance issues on dynamic SPA pages (e.g., Bilibili) by implementing 300ms debounce and global search fallback.
- **Fix**: Added pre-check filtering using `innerText` to prevent expensive DOM traversals for missing elements.
- **Fix**: Corrected data persistence logic to ensure restored mark details (`text`, `html`, `shadowHostSelector`) are properly updated in background storage.
- **Fix**: Improved markup sanitization to strip nested highlight tags (#4) and enhanced Markdown export format (#16).
- **Fix**: Optimized mutation observation to target specific comment containers instead of document.body, significantly reducing CPU overhead.

### [2026-04-10] Cross-Element Restoration & Self-healing

- **Feat**: Support restoring highlights spanning multiple block elements.
- **Feat**: Introduced "Mark Evolution" (Self-healing) mechanism that updates mark metadata after successful non-perfect recovery.
- **Feat**: Refactored search algorithm using Least Common Ancestor (LCA) and multi-anchor consensus.
- **Fix**: Improved search boundary alignment to prevent preview truncation in large content deletion scenarios.

### [2026-04-10] feat: automate CHANGELOG.md update and update GEMINI.md diagram (#19)

- **Feat**: automate CHANGELOG.md update and update GEMINI.md diagram

### [2026-04-08] - Highlight Disambiguation

- Implement tiered matching algorithm (Exact -> Contextual -> Fuzzy) for highlight restoration.
- New `DisambiguationModal` UI for manual resolution of multiple candidates.
- Context fingerprinting: Capture 20-char snippets before and after selection.
- Automatic storage repair: Update Rangy paths after successful manual resolution.

- Refactored `src/contentScripts/index.ts` to integrate tiered restoration flow.
- Enhanced `findCandidateElements` with fuzzy similarity scoring (Dice's Coefficient).

## [2025-12-22]

- Add '结构性回顾' to package.json keywords (194a907)

## [2025-12-30]

- Merge pull request #5 from catx1726/task/3-fix-shadow-dom (096d935)

## [2025-12-30]

- Merge pull request #8 from catx1726/task/7-options-desc (9d9c57a)

## [2025-12-30]

- Merge pull request #9 from catx1726/task/6-options-blacklist (0b1b4cb)

## [2025-12-31]

- Merge pull request #11 from catx1726/task/10-side-save (9db9003)
