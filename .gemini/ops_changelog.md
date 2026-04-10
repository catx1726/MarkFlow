# Operations Changelog

| Time | Action | Target | Reason | Commit_ID | Undo_CMD |
| :--- | :----- | :----- | :----- | :-------- | :------- |
| 2026-04-09 08:48:56 | Implement highlight disambiguation | src/contentScripts/index.ts, src/logic/dom.ts, src/logic/search.ts, src/logic/storage.ts | Enhance highlight restoration robustness with tiered matching and UI integration | f61de6a | - |
| 2026-04-10 12:53:27 | Finalize highlight disambiguation logic | src/contentScripts/index.ts, src/logic/search.ts, src/logic/dom.ts, src/background/main.ts, README.md | Ensure pixel-perfect restoration using local absolute coordinates and prevent fingerprint pollution | HEAD | - |
