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
