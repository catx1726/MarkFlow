# Task 003: 增量恢复 — 仅对新增内容建 context 搜索

## Context
无限滚动/虚拟列表回收重渲染的内容恰是 `addedNodes`，但 `src/contentScripts/monitor.ts:22-28` 丢弃了该信息，统一走全页搜索（`O(全页)`）。回收重渲染产生新节点 → Rangy 序号路径失效 → 必落搜索兜底 → 滚动卡顿残留源。

## Target Logic
1. monitor.ts：`pendingAddedRoots: Set<Element>` 收集防抖窗口内新增子树根（Element 化、isConnected 过滤、contains 嵌套去重、输入上下文过滤复用 001 的判定）；observer 触发 `debouncedRestore(true)` 增量，SPA/pushState 触发全量；全量待执行时增量不降级；增量 pass 加 1s 最小间隔节流（合并期间 roots 累积不清空）
2. index.ts：restoreCallback 签名 `(scopeRoots?: Element[]) => Promise<void>`
3. restorer.ts：`restoreHighlights(scopeRoots?: Element[])`——窗内增量 pass 绕过 5s 完成态早退；增量触发但窗外/首次 → 自动升级全量；增量模式下 shadow 标记跳过搜索不写冷却（全量重验兜底）；增量搜索走 `findCandidateElementsInRoots` 多根聚合
4. search.ts：新增导出 `findCandidateElementsInRoots(mark, roots: Node[])`——各根执行策略（context 缓存去重）、候选聚合后统一 resolveAmbiguity；`findCandidateElements` 退化为单根特例

## Verification
```bash
npx vitest run src/tests/restorer.spec.ts src/tests/monitor.spec.ts src/tests/search.spec.ts
```
