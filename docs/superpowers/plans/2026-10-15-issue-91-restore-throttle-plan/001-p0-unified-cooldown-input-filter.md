# Task 001: P0 — 统一失败冷却 + 指数退避 + monitor 输入过滤

## Context
`src/contentScripts/restorer.ts::restoreBySearch()` 的 `multiple`（341-343）、similarity 不足（337-339）、apply 失败（333-335）、shadow host 缺失（254-258）分支裸 `return false` 无冷却；`none` 分支（346）硬编码 3000。`src/contentScripts/state.ts` 有现成 `markFailed()` 未被复用。

## Current Logic
失败标记无冷却 → 每个 300ms 防抖周期全部重搜 → 循环 Long Task。

## Target Logic
1. restorer.ts：全部失败分支统一 `this.state.markFailed(mark.id)`；成功分支已有 `failedRestoreCooldowns.delete` 保持
2. state.ts：`markFailed` 指数退避——新增 `failureStreaks: Map<string, number>`，冷却 = `min(COOLDOWN_DURATION * 2^(streak-1), 30_000)`；`markRestored`/`clearCooldown` 清除 streak
3. monitor.ts：observer 回调中，若所有 mutation 的 target 向上遍历命中 `HTMLInputElement`/`HTMLTextAreaElement`/`isContentEditable` 则跳过（打字类变更静默）

## Verification
```bash
npx vitest run src/tests/restorer.spec.ts src/tests/state.spec.ts src/tests/monitor.spec.ts
```
