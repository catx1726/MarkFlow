# Unreleased

### [2026-06-02] Refactor Sidepanel into Composables and Components (#47)
Refactor Sidepanel into Composables and Components


### [2026-06-01] fix: storage race condition and data loss prevention (#45)
fix: storage race condition and data loss prevention


### [2026-05-25] feat: GitHub Gist Synchronization (#41)
feat: GitHub Gist Synchronization


# Released

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

- Merge pull request #9 from catx1726/test/6-options-blacklist (0b1b4cb)

## [2025-12-31]

- Merge pull request #11 from catx1726/task/10-side-save (9db9003)

## [2025-12-31]

- doc: 修改插件名称为 MarkFlow (da9a405)

## [2025-12-31]

- Merge branches 'main' and 'main' of github.com:catx1726/Tool-Webext-Tag-Content (83a87c4)

## [2025-12-31]

- Merge branch 'main' of https://github.com/catx1726/MarkFlow (39f9c07)

## [2025-12-31]

- build: 0.5.0 (59dcd09)

## [2025-12-31]

- doc: index.html (ce80904)

## [2025-12-31]

- Merge branch 'main' of github.com:catx1726/MarkFlow (b2812c5)

## [2025-12-31]

- Merge pull request #13 from catx1726/task/12-alt-fix (2438e90)

## [2025-12-31]

- env:update version (f197d9d)

## [2026-03-27]

- Merge branch 'main' of github.com:catx1726/MarkFlow (6824d53)
