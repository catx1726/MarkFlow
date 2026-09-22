# Task 002: 协议与 content script 接线

## Context

- 协议类型： `shim.d.ts:5-27` `ProtocolMap`
- 捕获钩子点： `src/contentScripts/restorer.ts:386`（`scrollIntoView` 之前）
- 消息注册： `src/contentScripts/index.ts:317-319`（`onMessage('goto-mark')` 旁）

## Current Logic

```typescript
// restorer.ts:386 — 直接滚动，无捕获
element.scrollIntoView({ behavior: 'auto', block: 'center' })
```

## Target Logic

1. `shim.d.ts` 新增两条协议（kebab-case，对齐现有风格）：

```typescript
'jump-back': ProtocolWithReturn<void, { depth: number }>
'get-jump-history-depth': ProtocolWithReturn<void, { depth: number }>
```

2. `restorer.ts` `scrollToMark`：在 `scrollIntoView` 之前插入 `jumpHistory.capture(element)`（在 `element` 与 `mark` 均校验通过之后）。
3. `src/contentScripts/index.ts` 注册：

```typescript
onMessage('jump-back', () => {
  jumpHistory.restore()
  return { depth: jumpHistory.depth }
})
onMessage('get-jump-history-depth', () => ({ depth: jumpHistory.depth }))
```

`jump-back` 返回剩余深度，侧边栏一次往返即可更新按钮状态。

## Verification

```bash
npm run typecheck
npm test
```
