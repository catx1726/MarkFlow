# Issue #91 Restore Throttle & Search Cost Design

## Goal
消除打字触发的 300ms 循环全文搜索卡顿，并为单次搜索兜底建立成本上界。

## Approach
P0：`restoreBySearch` 全部失败分支统一进冷却（复用 `state.markFailed`），配合 monitor 过滤输入类 DOM 变更，使失败页也能进入 5s 完成态早退；冷却升级为连续失败指数退避（3s→30s 封顶，成功清零）。P1：SearchContext 按 root 做 pass 级 WeakMap 缓存、structureBoundaries 用 Map 索引替代 indexOf、ExactMatch 候选封顶 10、refineBoundary 边界检查二分化、正则空白量词限界 `{0,10}`。增量恢复：monitor 收集防抖窗口内 addedNodes 子树根（去重/输入过滤/isConnected），observer 触发的恢复仅对新增子树建 context 搜索（O(新增) 而非 O(全页)）；增量 pass 不受 5s 完成态早退拦截，但窗外到期自动升级为全量 pass；SPA 导航/手动刷新仍走全量。

## References
- 失败分支: `src/contentScripts/restorer.ts::restoreBySearch()` (341-348)
- 冷却状态: `src/contentScripts/state.ts::HighlightStateManager.markFailed()`
- 搜索热点: `src/logic/search.ts::createSearchContext()/refineBoundary()`
- 完整 MRI: `.temp/mri-issue-91.md`

## Boundaries
- background `get-marks-for-url` 不过滤 `restoreFailedAt`（保持页面刷新后重试语义，该字段仅 UI 消费）
- 不做 `Candidate.displayContext` 惰性化（消费方为歧义弹窗/列表组件，改 getter 有 shape 风险，封顶已锁调用次数）
- SearchContext 缓存为 pass 级：`restoreHighlights()` 入口失效 + 高亮成功应用后失效，杜绝脏缓存
- 修复 A1（统一冷却）后 A2（完成态失效）自动解决，无需单独改动
- 增量搜索不穿透 Shadow DOM（MutationObserver 不观察 shadow root 内部变更，现状已如此）：增量 pass 中 shadow 标记跳过搜索不写冷却，由全量重验兜底
- 增量 roots 做轻量 contains 去重（批内/跨批嵌套），O(k) 每次添加
