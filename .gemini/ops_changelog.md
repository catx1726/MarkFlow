# Operations Changelog

| Time | Action | Target | Reason | Commit_ID | Undo_CMD |
| :--- | :----- | :----- | :----- | :-------- | :------- |
| 2026-04-09 08:48:56 | Implement highlight disambiguation | src/contentScripts/index.ts, src/logic/dom.ts, src/logic/search.ts, src/logic/storage.ts | Enhance highlight restoration robustness with tiered matching and UI integration | f61de6a | - |
| 2026-04-10 12:53:27 | Finalize highlight disambiguation logic | src/contentScripts/index.ts, src/logic/search.ts, src/logic/dom.ts, src/background/main.ts, README.md | Ensure pixel-perfect restoration using local absolute coordinates and prevent fingerprint pollution | HEAD | - |
| 2026-04-10 13:30:00 | Add post-mortem report for task 17 | .ai/archive/17_summary.md | Satisfy SOP requirement for task completion | HEAD | - |
| 2026-04-10 16:20:00 | Automate CHANGELOG.md update and update GEMINI.md diagram | .github/workflows/close_loop.yml, GEMINI.md | Close the loop for user-facing changes and update SOP docs | 3ed03ef | - |
| 2026-04-14 11:30:00 | Implement robust cross-element restoration with self-healing | src/contentScripts/index.ts, src/logic/search.ts, src/logic/dom.ts, src/background/main.ts, README.md | Support cross-element highlights, self-healing, and global fallback for dynamic pages (Bilibili/Reddit) | 5f22aea | git reset --hard HEAD~1 |
| 2026-04-14 17:00:00 | Fix nested highlight capture and Markdown export | src/logic/dom.ts, src/contentScripts/index.ts, src/sidepanel/Sidepanel.vue | Strip existing highlight tags when capturing HTML (#4) and use Turndown for Markdown export (#16) | 76eed4e | git reset --hard HEAD~1 |
| 2026-04-15 10:00:00 | Optimize restoration performance | src/contentScripts/index.ts, src/logic/dom.ts | Reduce debounce delay, add pre-check filtering and improve performance for Bilibili/SPA pages | 0273629 | git reset --hard HEAD~1 |
| 2026-04-17 16:45:00 | Refactor search logic with Strategy Pattern | src/logic/search.ts | Improve SRP/OCP adherence and eliminate magic numbers via SEARCH_CONFIG | HEAD | git checkout main && git branch -D issue-22 |
| 2026-04-17 16:50:00 | Encapsulate DOM utilities into static classes | src/logic/dom.ts | Improve logical grouping (DOMScanner, Highlighter, etc.) while maintaining backward compatibility | HEAD | git checkout main && git branch -D issue-22 |
| 2026-05-08 15:30:00 | Refactor content script into class architecture | src/contentScripts/index.ts, src/contentScripts/state.ts, src/contentScripts/ui.ts, src/contentScripts/monitor.ts, src/contentScripts/restorer.ts, src/logic/shadowDom.ts | Split 1083-line index.ts into 5 classes with clear responsibilities (Issue #26) | HEAD | git checkout main && git branch -D issue-26-v2 |
| 2026-05-11 11:45:00 | Implement sidebar sorting optimizations | src/logic/storage.ts, src/contentScripts/ui.ts, src/sidepanel/Sidepanel.vue | Sort markups by physical position (domIndex) and pages by recency (Issue #31, #32) | HEAD | git checkout main && git branch -D feature/sorting-optimizations |
| 2026-05-11 14:30:00 | Fix restoration bug on dynamic sites (Zhihu) | src/contentScripts/restorer.ts, src/contentScripts/state.ts | Debounce disambiguation modal and auto-resolve items when restored via Rangy path | 0f66f5d | git reset --hard HEAD~1 |
| 2026-05-19 11:30:00 | Implement error collection filtering and handle ErrorEvent | src/logic/errorCollector.ts, src/tests/errorCollector.spec.ts | Filter out host page noise and improve robustness for ErrorEvent (Issue #34) | aa08cba | git reset --hard HEAD~1 |
| 2026-05-20 12:30:00 | Implement and optimize content association and hierarchical sidebar | src/sidepanel/Sidepanel.vue, src/background/main.ts, src/contentScripts/ui.ts | Realize "Tag -> Page -> Mark" structure and fix data consistency via SSOT (Issue #33) | 9ff0d0f | git checkout main && git branch -D feature/content-association |

| 2026-05-21 01:25:00 | Merge PR #37 after 4 rounds of AI CR fixes | src/background/main.ts, src/sidepanel/Sidepanel.vue, src/contentScripts/views/Tooltip.vue, src/logic/tagTree.ts | Fix concurrency safety, deadlock, race conditions, queue robustness; merge into main (Issue #33) | 4d1dac4 | git revert -m 1 4d1dac4 |
| 2026-05-21 16:50:00 | Implement sidebar accordion, count badges and optimized Markdown export | src/logic/tagTree.ts, src/sidepanel/Sidepanel.vue, docs/superpowers/specs/2026-05-21-ux-improvements-design.md, docs/superpowers/plans/2026-05-21-ux-improvements-plan.md | Resolve "scrolling hell" with mutual-exclusion interaction (#39) and improve Markdown embedding compatibility (#38) | HEAD | git checkout main && git branch -D feat/ux-optimization-issue-38-39 |

---

## Self-Reflection: UX Improvements & Markdown Optimization (Issues #38 & #39)

**Execution Summary:**
- 实现基于原生 `<details name="...">` 的互斥手风琴交互，实现零 JS 状态管理，彻底解决侧边栏“滚动地狱”问题 (#39)。
- 在 `TagTree` 逻辑层引入 `totalMarks` 预计算，为侧边栏文件夹提供实时的数量徽章与空状态置灰视觉反馈。
- 重构 Markdown 导出模板，将所有 `#` 标题降级为 `> 引用` 和 `**加粗**` 样式，显著提升了标记片段在 Obsidian 等文档工具中的嵌入兼容性 (#38)。
- 修复了文件夹折叠状态下底部圆角丢失的 UI 细节问题。

**Key Challenges & Lessons:**
1. **原生特性优先**：对于 Accordion 等标准交互，原生 `<details>` 结合 `name` 属性（Chrome 120+）比 Vue 手动管理 `activeId` 更简洁且无障碍支持更好。
2. **视觉细节**：使用 `group-open` 修改父级圆角样式是处理折叠面板视觉连贯性的关键。
3. **导出颗粒化**：导出内容从“完整文档”向“可嵌入片段”的思维转变，更能满足重度知识管理用户的拼凑式工作流。

---

## Self-Reflection: Content Association Feature (Issue #33)

**Execution Summary:**
- Successfully implemented "Tag -> Page -> Mark" hierarchical sidebar with `buildTagTree` pure function.
- Introduced `enqueueWrite` serialized write queue to prevent storage corruption in concurrent operations.
- Removed `refreshAllMarks` optimistic updates in favor of SSOT (storage sync + background broadcast), eliminating data inconsistency bugs.
- Added `remove-marks` batch message for efficient bulk deletion.
- Completed 4 rounds of AI CR fixes addressing blocking issues around concurrency, deadlocks, race conditions, and queue safety.

**Key Challenges & Lessons:**
1. **Vue Reactivity + Storage Sync**: Direct mutation of nested objects in `marksByUrl.value` does not reliably trigger `useWebExtensionStorage` persistence. Full object replacement (`{ ...obj }`) is necessary but expensive.
2. **Write Queue Design**: Initial naive Promise chain caused deadlocks when errors were unhandled. The fix was adding rejection handlers that allow the queue to continue (`writeQueue = result.catch(...)`).
3. **AI CR Round 5 Hallucination**: The final CR round flagged issues (`refreshAllMarks`, `watch deep`, `get-all-tags`) that did not exist in the actual merged code. This suggests AI CR tools may cache or hallucinate code snapshots. Human verification remains essential.
4. **Content Script Refresh Separation**: Sidepanel data refresh (via storage sync) and content script highlight refresh (via explicit `refresh-highlights` message) must remain separate channels to avoid regressions.

**What Would I Do Differently:**
- Implement `enqueueWrite` with proper error propagation (e.g., using a typed queue library like `p-queue`) from the start rather than hand-rolling a Promise chain.
- Write unit tests for `buildTagTree` and `enqueueWrite` before the first CR round to catch edge cases early.
- Consider using `shallowRef` for large reactive objects to reduce Vue reactivity overhead.

| 2026-05-23 16:35:00 | Implement and Refine GitHub Gist Synchronization | src/logic/sync.ts, src/logic/storage.ts, src/options/Options.vue, src/background/main.ts, src/manifest.ts, docs/user-guide/github-sync.md | Add cross-device sync via GitHub Gist with automated background push/pull, timestamp merging, tombstone deletion, and exponential backoff retry (Issue #41, #42, #43) | HEAD | - |
| 2026-06-02 08:55:00 | Refactor Sidepanel into modular Composables and Components | src/sidepanel/Sidepanel.vue, src/sidepanel/composables/*, src/sidepanel/components/*, src/tests/tagTree.spec.ts | Modularize monolithic Sidepanel.vue into 5 domain-specific composables and 5 focused UI components to improve maintainability and testability (Issue #46) | e14fd1d | git checkout main && git branch -D issue-46 |
| 2026-06-02 09:30:00 | Fix Blocking CR issues and sync documents | src/sidepanel/Sidepanel.vue, src/sidepanel/composables/useTagActions.ts, src/sidepanel/composables/useMarkActions.ts, docs/superpowers/* | Resolve tag picker state management bugs, fix race conditions in tagging, improve error handling in deletion, and restore missing spec/plan docs (Issue #46) | HEAD | - |
| 2026-06-29 21:30:00 | Fix initial sync overwrite bug and integrate into UX branch | src/logic/sync.ts, src/background/main.ts, src/options/Options.vue, src/tests/sync.spec.ts, docs/NIT_ROADMAP.md | Prevent local empty state from overwriting remote Gist; use getGistById to read content; pull-then-enable with timeout; error-recovery pull-before-push; preserve UX branch features | bfae7f7 | git revert -m 1 bfae7f7 |
| 2026-07-03 19:40:00 | Implement sidepanel search with context preservation | src/sidepanel/components/SidepanelHeader.vue, src/sidepanel/Sidepanel.vue, src/sidepanel/composables/searchFilter.ts, src/sidepanel/composables/useSidepanelData.ts, src/sidepanel/composables/useTagActions.ts | Add persistent search input to sidepanel; preserve full page context by default; add compact mode toggle; collapse create-tag into + button (Issue #52) | 894b762 | git revert -m 1 894b762 |
| 2026-07-28 17:30:00 | Remember last-used tags and preselect on new mark | src/logic/settings.ts, src/logic/tags.ts, src/contentScripts/index.ts, src/contentScripts/ui.ts, src/contentScripts/views/Tooltip.vue, src/tests/tags.spec.ts | Persist lastUsedTags in local settings (not Gist-synced); preselect on new mark; filter ghost tag ids in Tooltip.show(); only NEW-mark branch (createHighlight) updates memory, editing existing marks untouched (Issue #54) | 9312f25 | git revert 9312f25 |
| 2026-07-28 19:40:00 | Fix tooltip hiding on tag-create button click | src/contentScripts/views/Tooltip.vue | Root cause: tooltip-card root had @mousedown.stop but NOT @mouseup.stop; clicking the create-tag button let mouseup bubble to document handleMouseUp -> selectionTimer -> processSelection -> hide(), closing the tooltip right after the tag was created (tag was actually saved; sidebar showed it; tooltip needed reopen). Enter key worked because it emits no mouseup. Fix: add @mouseup.stop mirroring @mousedown.stop. | df1bf3a | git revert -m 1 df1bf3a |
| 2026-07-28 20:00:00 | Finalize v0.7.2 release: docs, version bump, and changelog | package.json, docs/index.html, CHANGELOG.md, docs/RELEASE_v0.7.2.md | Mark v0.7.2 as released on 2026-07-28; bump version to 0.7.2; remove draft marker; move Unreleased entries to Released section | HEAD | git revert HEAD |
| 2026-07-29 10:19:00 | Fix tooltip tag creation second-click unresponsiveness (PR #59) | src/contentScripts/views/Tooltip.vue, src/contentScripts/index.ts, src/background/main.ts | Root cause: after create-tag, calling get-all-tags roundtrip would hang on second invocation, leaving UI without feedback. Fix: use the Tag object returned by create-tag directly to update allTags and selectedTags; clean up diagnostic logs. | 52730ac | git revert -m 1 52730ac |

---

## Self-Reflection: Sidepanel Modularization (Issue #46)

**Execution Summary:**
- 成功将 800 余行的单体文件 `Sidepanel.vue` 重构为模块化架构。
- 提取了 5 个领域驱动的 Composables (`useSidepanelData`, `useUIState`, `useTagActions`, `useMarkActions`, `useStorageMonitor`)，实现了业务逻辑与组件生命周期的深度解耦。
- 拆分了 5 个功能单一的 UI 组件 (`SidepanelHeader`, `TagFolder`, `PageSection`, `MarkItem`, `StorageManager`)，大幅降低了模板嵌套深度和认知负载。
- 针对 CR 反馈，将 `refreshAllMarks` 逻辑及消息监听器集成到 `useSidepanelData` 中，确保了消息监听器在组件卸载时能正确清理，防止内存泄漏。
- 补齐了 `buildTagTree` 的核心逻辑单元测试 (`src/tests/tagTree.spec.ts`) 及所有 Composables 的单元测试。

**Key Challenges & Lessons:**
1. **生命周期安全性**：在 Composables 中管理全局消息监听器（如 `runtime.onMessage`）时，必须严格遵守 `onMounted`/`onUnmounted` 对称性，尤其是在涉及响应式数据修改（如 `marksByUrl.value = ...`）时。
2. **状态正交性**：最初误将“标签选择”和“备注编辑”的状态混用，通过引入独立的 `editingMarkId` 实现了交互状态的清晰隔离。
3. **组件通信成本**：在深度嵌套的组件树中，事件转发（Emit forwarding）虽然略显繁琐，但相比全局 Store，它提供了更好的 Prop 类型追踪和组件纯净性。

**What Would I Do Differently:**
- 在重构初期就应考虑到全局消息监听的归属问题，将其作为 Data Composable 的一部分，而不是留在视图容器中。
- 预先执行更严格的 ESLint 检查，避免在提交阶段因格式问题导致流水线失败。

---

## Self-Reflection: GitHub Gist Sync

**Execution Summary:**
- 实现基于 GitHub Gist API 的轻量级同步方案，支持多端数据同步。
- 引入 `deletedAt` (Tombstone) 机制，解决了分布式系统中的删除同步问题，并实现了同步后的物理清理（Purge）。
- 为数据拉取（Pull）实现了指数退避重试（Exponential Backoff），增强了弱网环境下的健壮性。
- 引入了 `syncInProgress` 互斥锁和 `enqueueWrite` 队列集成，确保了并发读写下的数据一致性。
- 在 Options 页面提供了完整的引导流程和详细的错误提示（针对 401/403 状态码）。

**Key Challenges & Lessons:**
1. **数据一致性与软删除**：在 Local-first 系统中，简单的物理删除无法同步到其他离线设备。通过引入 `deletedAt` 时间戳并在拉取合并后执行物理清理，既实现了删除同步又防止了数据无限增长。
2. **并发控制**：网络请求（Push/Pull）与本地存储写入的异步性可能导致竞争。通过互斥锁和序列化队列的结合，确保了存储状态的确定性。
3. **环境限制与调试**：由于沙盒环境的网络限制，`gh` 工具在大数据包请求时可能失败，通过拆分任务和本地验证确保了工程质量。
| 2026-08-20 13:20:00 | Unify brand color to amber + Tooltip anchor-aware positioning & drag | src/ (12 style files), src/logic/tooltipPosition.ts, src/contentScripts/{index,ui,state}.ts, src/contentScripts/views/Tooltip.vue, docs/index.html, assets/, extension/assets/ | Brand unification (blue/indigo→amber highlighter metaphor), selection-aware tooltip placement with header drag; fix rangy WrappedRange lacking runtime getBoundingClientRect (Issue #62) | a7b9749,5e7626f | git revert a7b9749 5e7626f |
| 2026-08-20 13:35:00 | Address AI CR blocking items for PR #63 | src/logic/tooltipPosition.ts, src/contentScripts/views/Tooltip.vue | Add warn log on getRangyRangeRect fallback path; rAF-throttle drag pointermove to avoid layout thrashing | HEAD | git revert HEAD |
| 2026-08-20 14:05:00 | Address 4 rounds of AI CR feedback for PR #63 | src/logic/tooltipPosition.ts, src/contentScripts/{index.ts,views/Tooltip.vue,views/ListItemComponent.vue}, src/logic/i18n.ts, src/tests/tooltipPosition.spec.ts | getRangyRangeRect returns null w/ caller-side degradation + native Range compat; explicit rule-0 for viewport-taller tooltip; pointerdown stopPropagation; hide() drag cleanup; show() el-null guard; hover state orange→amber; i18n small text amber-700; shared TOOLTIP_MARGIN; 14 tests green | HEAD | git revert HEAD |
| 2026-08-20 14:35:00 | Address round-5 AI CR for PR #63 | src/contentScripts/index.ts, src/logic/tooltipPosition.ts, src/contentScripts/views/Tooltip.vue, src/tests/tooltipPosition.spec.ts, docs/superpowers/specs/ | allSpans[0] optional-chaining guard; extract clampToViewport pure fn +3 tests; brand spec updated to amber final decision | HEAD | git revert HEAD |
| 2026-08-20 15:55:00 | UI polish sprint: readability, hierarchy flattening, micro-animations | src/contentScripts/views/Tooltip.vue, src/sidepanel/components/{TagFolder,PageSection}.vue | Tooltip small text 10→12px (keep px for Shadow DOM rem-immunity); TagFolder content area borderless w/ guide-line indent; PageSection drop shadow-sm; Tooltip pop transition; folder fold-in animation (Issue #65) | HEAD | git revert HEAD |
| 2026-08-20 17:00:00 | Driver visual-acceptance fixes for Issue #65 | src/sidepanel/**, src/contentScripts/views/Tooltip.vue, src/contentScripts/ui.ts | Sticky header opaque bg (scroll bleed fix); folder row sticky pinning w/ CSS var + ResizeObserver; folder pill rounding + light-theme material unification; grid 0fr/1fr height transition w/ layout containment; clampToViewport missing import fix | HEAD | git revert HEAD |
| 2026-08-20 17:40:00 | Round-6 CR fixes for Issue #65 | src/contentScripts/views/Tooltip.vue, src/sidepanel/** | Tooltip enter animation bound to isPositioned (skip measuring-phase dry run); dropdown menu clipping fixed by scoping overflow/contain to animation-active only; type assertion & layer comments | HEAD | git revert HEAD |
| 2026-08-20 18:00:00 | Existing-mark tooltip anchored to click point | src/contentScripts/index.ts, src/tests/tooltipPosition.spec.ts | Click-point anchor (context-menu style) for existing marks instead of whole-mark rect; new selections keep selection-rect anchoring; +1 point-anchor test | HEAD | git revert HEAD |
| 2026-08-20 18:20:00 | Round-7 CR fixes for Issue #65 | src/sidepanel/Sidepanel.vue, src/sidepanel/components/TagFolder.vue, src/contentScripts/ui.ts, docs/superpowers/specs/ | B2 instanceof guard; B1 sticky stacking assessed as false positive (exclusive accordion + sticky containing block); animation-sync & style comments; spec status approved | HEAD | git revert HEAD |
| 2026-08-20 18:50:00 | Pointer-aware tooltip positioning (v3) | src/logic/tooltipPosition.ts, src/contentScripts/** | Optional pointer param through call chain; vertical side follows pointer half, horizontal follows pointer.x; backward compatible without pointer; +4 tests (22 green) | HEAD | git revert HEAD |
| 2026-08-20 19:10:00 | Round-8 CR: options-object refactor for computeTooltipPosition | src/logic/tooltipPosition.ts, src/contentScripts/views/Tooltip.vue, src/tests/tooltipPosition.spec.ts | margin/gap/pointer positional params → TooltipPositionOptions; Blocking item confirmed as intended context-menu behavior | HEAD | git revert HEAD |
| 2026-08-20 20:00:00 | i18n English internationalization (PR-1) | src/logic/i18n/**, 17 UI files, extension/_locales, extension/manifest.json | TS dictionaries (zh-CN source / en type-enforced), reactive t(), settings.language manual switch + options select, _locales manifest bilingual; 158 keys; legacy i18n.ts migrated & deleted; tests/setup.ts polyfill mock | HEAD | git revert HEAD |
| 2026-08-20 20:30:00 | Fix default_locale: edit manifest generator not artifact | src/manifest.ts, extension/_locales/ | extension/manifest.json is build-generated & gitignored; __MSG_*/default_locale moved to src/manifest.ts source; _locales now tracked | HEAD | git revert HEAD |
| 2026-08-20 20:50:00 | Options section reorder + page title i18n | src/options/Options.vue, src/options/main.ts, src/sidepanel/main.ts | GitHub sync moved up, error logs last; document.title reactive via watchEffect for options/sidepanel entries | HEAD | git revert HEAD |
| 2026-08-20 21:10:00 | Round-9 CR: polyfill import + typed nav keys | src/logic/i18n/**, src/options/Options.vue | B1: browser via webextension-polyfill explicit import; N4: template-literal type for nav labels; N8: dictionary maintenance comment; B2 declined with rationale (ms-window, manual-locale users only) | HEAD | git revert HEAD |
| 2026-08-20 21:40:00 | Folder-level collapse/expand height animation | src/sidepanel/components/TagFolder.vue | Intercept summary click; grid 0fr↔1fr 150ms both directions; keep native details name exclusive accordion; no animation on initial mount | HEAD | git revert HEAD |
| 2026-08-20 22:00:00 | Round-10 CR: false positive + guard comments | src/logic/i18n/locales/ | Markdown export labels already carry language-correct separators; added do-not-trim comments | HEAD | git revert HEAD |
| 2026-08-20 22:50:00 | Landing page English version (i18n PR-2) | docs/lang/en/index.html, docs/index.html | Full EN translation, bidirectional lang links, og:locale en_US; CDP screenshot acceptance | HEAD | git revert HEAD |
| 2026-08-20 23:00:00 | Manual theme toggle (auto/light/dark) | src/logic/theme.ts, src/theme-init.ts, 3 pages, contentScripts/ui.ts, Options.vue | Shared isDark computed replaces per-page usePreferredDark; localStorage mirror for FOUC-free init; theme select in options General section | HEAD | git revert HEAD |
| 2026-08-20 23:20:00 | Round-11 CR: theme toggle fixes | src/theme-init.ts, src/logic/theme.ts, src/options/Options.vue, src/tests/theme.spec.ts | B2 localStorage try-catch; B1 false positive (deep ref tracks nested props); resolveTheme undefined-safe + test; shared select class const | HEAD | git revert HEAD |
| 2026-08-20 23:50:00 | Fix missing vitest setupFiles registration + sidepanel menu flip | vite.config.mts, src/sidepanel/**, src/sidepanel/composables/__tests__/menuPosition.spec.ts | PR #69's setupFiles line was never committed (git add missed root config) — main had 11 failing test files; dropdown menus flip upward when near viewport bottom (menuPosition util + 4 tests); 4 events camelCased | HEAD | git revert HEAD |
| 2026-08-21 00:10:00 | Round-12 CR: MENU_HEIGHTS const + test hardening | src/sidepanel/composables/menuPosition.ts, MarkItem.vue, PageSection.vue, menuPosition.spec.ts | Blocking dismissed (Vue camelizes template listeners); estimated heights centralized; innerHeight pinned in test. Driver's local margin tweaks (SidepanelHeader/TagFolder) left uncommitted per instruction | HEAD | git revert HEAD |
| 2026-08-21 09:50:00 | Fix menu flip not working: UnoCSS doesn't scan .ts string literals | src/sidepanel/{components,composables} | bottom-full/mb-2 from menuPlacementClass never reached compiled CSS; moved class selection inline into .vue templates (scannable), removed menuPlacementClass helper. Verified bottom-full in built CSS | HEAD | git revert HEAD |
| 2026-08-21 10:10:00 | Fix menu clipping layer 2: TagFolder fold-inner permanent overflow | src/sidepanel/components/TagFolder.vue | overflow:hidden now scoped to fold-anim window only; steady-state menus no longer clipped by folder collapse container | HEAD | git revert HEAD |
| 2026-08-21 10:40:00 | Fix fold-inner horizontal overflow | src/sidepanel/components/{PageSection,TagFolder}.vue | Grid children default min-width:auto → long unbreakable titles overflow; added min-width:0 | HEAD | git revert HEAD |
| 2026-08-21 11:00:00 | Page-level mark count badge | src/sidepanel/components/PageSection.vue | Adds (n) count next to page title, matching chapter-level style; uses existing urlData.totalMarks | HEAD | git revert HEAD |
