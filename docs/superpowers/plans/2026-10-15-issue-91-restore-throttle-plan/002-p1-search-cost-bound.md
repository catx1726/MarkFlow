# Task 002: P1 — search.ts 搜索成本上界

## Context
`src/logic/search.ts`：`createSearchContext`（314-337）对每个块元素做 2 次 `Array.indexOf` O(N)；`ExactMatchStrategy`（57-69）候选无上限；`RegexMatchStrategy`（81）`[\s\u200b]*` 无界；`LocalAligner.refineBoundary`（221-256）双层 80×80 循环内 `structureBoundaries.some()` O(B)；`restorer.ts:264-268` 二次全页重搜重复建 context。

## Target Logic
1. pass 级缓存：模块级 `searchContextCache: WeakMap<Node, {version, context}>` + `searchCacheVersion`；导出 `invalidateSearchContextCache()`；`findCandidateElements` 改用 `getSearchContext(root)`。失效点：`restoreHighlights()` 入口 + `restoreBySearch()` 成功应用后（DOM 已变，保守失效；失败路径不改 DOM，多失败标记复用）
2. `createSearchContext`：`Map<Text, number>` 索引替代 `indexOf`
3. `ExactMatchStrategy`：候选 >10 break（对齐 Regex）
4. `refineBoundary`：`excluded = boundaries.filter(!markText.includes).sort(byIndex)` + 前缀 max-end 数组；起始点检查二分 O(log B)；跨界检查用单调前进指针（j 递增，p 只前进），`crossed = p > firstAfterI`
5. Regex 空白量词 `[\s\u200b]{0,10}`

## Verification
```bash
npx vitest run src/tests/search.spec.ts src/tests/cross-element.spec.ts src/tests/repro_issue.spec.ts
```
