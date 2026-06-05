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
