# Task 001: JumpHistoryManager 模块（TDD）

## Context

跳转执行点 `src/contentScripts/restorer.ts:379-399` `scrollToMark` 目前直接 `scrollIntoView`，跳转前位置丢失。需新增独立栈管理模块（对齐 `state.ts`/`monitor.ts` 的 manager-per-file 模式）。

## Target Logic

新文件 `src/contentScripts/jumpHistory.ts`：

```typescript
interface ScrollPosition {
  x: number
  y: number
  ancestors: Array<{ el: Element, top: number, left: number }>
}

const MAX_DEPTH = 50

class JumpHistoryManager {
  private stack: ScrollPosition[] = []

  /** 在 scrollIntoView 之前调用：记录 window 滚动位置 + target 全部可滚动祖先 */
  capture(target: Element): void

  /** 弹栈并恢复位置；栈空返回 false。祖先已脱离 DOM 时跳过该层仅恢复 window */
  restore(): boolean

  get depth(): number
}

export const jumpHistory = new JumpHistoryManager()
```

要点：

- 可滚动祖先判定：`scrollHeight > clientHeight || scrollWidth > clientWidth` 且 computed `overflow-y/x ∈ {auto, scroll}`
- 祖先遍历需穿透 shadow DOM：`el.parentElement ?? (el.getRootNode() as ShadowRoot).host`，直到 `document.body` 为止
- 超 MAX_DEPTH 丢弃最底层（`stack.shift()`）
- `restore()`：`el.isConnected` 检查后再写 `scrollTop/scrollLeft`；`window.scrollTo(x, y)` 兜底

## TDD

先写 `src/tests/jumpHistory.spec.ts`（Vitest + jsdom，参照 `src/tests/restorer.spec.ts` 风格）：

1. 空栈 `restore()` 返回 false 且不调用 `window.scrollTo`
2. `capture` 记录 window 位置与可滚动祖先（jsdom 中用 `Object.defineProperty` 模拟 scrollHeight/clientHeight）
3. `restore()` 后深度减一、`window.scrollTo` 收到记录的坐标
4. 多级：capture×2 → restore×2 按 LIFO 顺序恢复
5. 超 50 层丢弃最底层
6. 祖先脱离 DOM（`isConnected=false`）时仅恢复 window

## Verification

```bash
npm test -- jumpHistory
```
