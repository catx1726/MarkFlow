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
| 2026-04-21 11:15:00 | Refactor content script into modular architecture | src/contentScripts/ | Decouple UI, interaction and restoration logic into MarkerApp, InteractionController, RestorationEngine, and UIPortal (#24) | 2dcae22 | git checkout main && git branch -D issue-24 |
| 2026-04-21 12:45:00 | Finalize refactor with bug fixes and TSDoc | src/contentScripts/ | Fix Shadow DOM event target identification and add comprehensive TSDoc for refactored classes (#24) | 9c0d9be | git reset --hard HEAD~1 |
