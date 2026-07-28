# Operations Changelog

| Time | Action | Target | Reason | Commit_ID | Undo_CMD |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-06-05T09:35:00+08:00 | AI_AUTO_SNAP | workspace | Pre-Surgical-Workflow baseline for UI cleanup & dark mode fix | 900c5b4 | git reset --soft HEAD~1 |
| 2026-06-05T10:10:00+08:00 | DELETE | src/contentScripts/views/Prompt.vue | 清理未使用组件，零引用，风格脱节 | 8b4e5db | git checkout HEAD -- src/contentScripts/views/Prompt.vue |
| 2026-06-05T10:10:00+08:00 | UPDATE | src/contentScripts/views/DisambiguationModal.vue | 补充暗黑模式 dark: 变体 | 8b4e5db | git checkout HEAD -- src/contentScripts/views/DisambiguationModal.vue |
| 2026-06-05T10:10:00+08:00 | UPDATE | src/popup/Popup.vue | 视觉层次优化：主按钮蓝色+Logo SVG | 8b4e5db | git checkout HEAD -- src/popup/Popup.vue |
| 2026-06-05T10:10:00+08:00 | UPDATE | src/sidepanel/components/SidepanelHeader.vue | 设置按钮 absolute → fixed | 8b4e5db | git checkout HEAD -- src/sidepanel/components/SidepanelHeader.vue |
| 2026-06-05T10:10:00+08:00 | UPDATE | docs/NIT_ROADMAP.md | 标记 UI Review 完成项 | 8b4e5db | git checkout HEAD -- docs/NIT_ROADMAP.md |
| 2026-06-05T10:25:00+08:00 | FIX | src/sidepanel/components/SidepanelHeader.vue | 设置按钮 fixed 导致重叠和 hover 消失，改回 absolute + header sticky | f69136a | git checkout HEAD -- src/sidepanel/components/SidepanelHeader.vue |
| 2026-06-05T10:25:00+08:00 | FIX | src/popup/Popup.vue | 字体大小不统一(text-sm)、Logo 非品牌图标 | f69136a | git checkout HEAD -- src/popup/Popup.vue |
| 2026-06-05T10:30:00+08:00 | FIX | src/sidepanel/components/SidepanelHeader.vue | 将设置按钮从 absolute 右上角移入创建标签 flex 行，彻底解决重叠 | 4fe7c12 | git checkout HEAD -- src/sidepanel/components/SidepanelHeader.vue |
| 2026-06-05T10:48:00+08:00 | FEAT | src/sidepanel/components/StorageManager.vue | 存储管理器增加展开/折叠，默认仅显示进度条 | fe77205 | git checkout HEAD -- src/sidepanel/components/StorageManager.vue |
| 2026-06-05T11:20:00+08:00 | RESTORE | src/styles/main.css + Sidepanel.vue + StorageManager.vue | 从被撤回的 commit 694ea52 恢复 UI 修复 | a661ad9 | git checkout HEAD -- src/styles/main.css src/sidepanel/Sidepanel.vue src/sidepanel/components/StorageManager.vue |
| 2026-06-05T11:33:00+08:00 | FIX | src/styles/main.css + Sidepanel.vue | 6px半透明滚动条替代预留gutter、空状态flex-1铺满 | 5acfbb6 | git checkout HEAD -- src/styles/main.css src/sidepanel/Sidepanel.vue |
| 2026-06-05T12:20:00+08:00 | FIX | StorageManager + Sidepanel + SidepanelHeader | 按钮跳动修复、空状态高度动态化、边距统一 | 35c2fe5 | git checkout HEAD~2 -- src/sidepanel/ src/sidepanel/components/SidepanelHeader.vue |
| 2026-06-05T12:22:00+08:00 | FIX | src/styles/main.css | 使用 scrollbar-gutter: stable 消除滚动条导致的布局抖动 | 26be3f3 | git checkout HEAD -- src/styles/main.css |
| 2026-06-05T12:27:00+08:00 | FIX | src/styles/main.css + Sidepanel.vue | 透明滚动条轨道替代预留空间，背景色限定在 sidepanel | 7ecf8db | git checkout HEAD -- src/styles/main.css src/sidepanel/Sidepanel.vue |
| 2026-06-05T12:32:00+08:00 | FIX | src/sidepanel/Sidepanel.vue | Firefox 滚动条颜色与宽度（scrollbar-width + scrollbar-color） | baad8c3 | git checkout HEAD -- src/sidepanel/Sidepanel.vue |
| 2026-06-05T12:38:00+08:00 | FIX | src/sidepanel/Sidepanel.vue | Firefox 滚动条 track 改用实色背景替代 transparent | 75d2413 | git checkout HEAD -- src/sidepanel/Sidepanel.vue |
| 2026-06-05T12:42:00+08:00 | REFACTOR | src/styles/main.css + Sidepanel.vue | 滚动条颜色提取为 CSS 自定义属性集中管理 | 586ee07 | git checkout HEAD -- src/styles/main.css src/sidepanel/Sidepanel.vue |
| 2026-06-05T12:48:00+08:00 | REFACTOR | main.css + Sidepanel + Tooltip + DisambiguationModal | 代码块与组件滚动条颜色提取为 CSS 变量 | 9125a46 | git checkout HEAD -- src/styles/main.css src/sidepanel/Sidepanel.vue src/contentScripts/views/Tooltip.vue src/contentScripts/views/DisambiguationModal.vue |
| 2026-06-05T12:55:00+08:00 | DOCS | README.md + docs/TECHNICAL.md | README 重写为简洁宣传风格，技术内容移至 TECHNICAL.md | 6f4cc09 | git checkout HEAD -- README.md docs/TECHNICAL.md |
| 2026-06-05T13:00:00+08:00 | DOCS | docs/index.html | 落地页 title/hero 文案同步 README 新定位 | c3fe4f1 | git checkout HEAD -- docs/index.html |
| 2026-07-28T11:10:00+08:00 | FIX | src/logic/sync.ts + src/background/main.ts + src/tests/sync.spec.ts | Surgical Workflow：GitHub 403 误判为认证失败导致同步间歇性自动断开。新增 GitHubAPIError 分类器（auth/rate-limit/not-found/storage-limit/unknown），区分 401 与 403，读取响应体与 X-RateLimit-Remaining/Retry-After 头；main.ts catch 改为按 error.kind 分流，仅确认 auth 才禁用同步，rate-limit 走退避不禁用。修复用户反馈"时不时断开"。 | pending | git checkout HEAD -- src/logic/sync.ts src/background/main.ts src/tests/sync.spec.ts |
