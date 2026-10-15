# Task 003: 测试补充与全量回归

## Context
Issue 验证要求：歧义（multiple）标记失败后进入冷却，300ms 防抖周期内不重复触发 `findCandidateElements`。

## Target Logic
1. `src/tests/restorer.spec.ts`：新增——页面文本重复（multiple 歧义）标记 restoreBySearch 失败后 `state.isOnCooldown(id) === true`；冷却期内再次 restoreHighlights 不再触发搜索（以 `[WebMarker-Search] Searching ID` console 计数断言）
2. `src/tests/state.spec.ts`：指数退避序列 3s→6s→12s→…→30s 封顶；`markRestored` 清零 streak
3. `src/tests/monitor.spec.ts`：contenteditable 子树内 childList 变更不触发回调；body 其它区域变更正常触发
4. `src/tests/search.spec.ts` beforeEach 调用 `invalidateSearchContextCache()` 防 DOM 跨测试脏缓存
5. 全量 `npx vitest run` + `npm run typecheck` + `npm run lint`

## Verification
```bash
npx vitest run && npm run typecheck
```
