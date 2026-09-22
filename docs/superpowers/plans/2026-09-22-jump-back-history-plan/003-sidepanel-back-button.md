# Task 003: 侧边栏返回按钮

## Context

- 工具栏： `src/sidepanel/components/SidepanelHeader.vue:59-90`（new-tag / settings 按钮，内联 SVG + `:title` tooltip）
- 发起跳转： `src/sidepanel/composables/useMarkActions.ts:24-47` `gotoMark`
- 组装点： `src/sidepanel/Sidepanel.vue:211`（`<SidepanelHeader>` props/emits 透传模式）
- i18n： `src/logic/i18n/locales/zh-CN.ts` / `en.ts`（`sidepanel.*` 命名空间）

## Target Logic

1. 新增 `src/sidepanel/composables/useJumpBack.ts`：

```typescript
export function useJumpBack() {
  const depth = ref(0)
  async function refreshDepth() // 查当前活动标签页 → get-jump-history-depth；content script 不可达（未注入页面）时 depth=0
  async function jumpBack()     // 发送 jump-back 到活动标签页，用返回的 depth 更新
  // onMounted + browser.tabs.onActivated 时 refreshDepth
  return { depth, jumpBack, refreshDepth }
}
```

2. `SidepanelHeader.vue`：settings 按钮左侧新增「返回」按钮
   - props 加 `jumpDepth: number`，emits 加 `(e: 'jump-back'): void`
   - 内联 SVG 左箭头（h-5 w-5，样式 class 对齐 settings 按钮）；`jumpDepth === 0` 时禁用（`disabled` + `opacity-40 cursor-not-allowed`）
   - `:title="t('sidepanel.jumpBack')"`
3. `Sidepanel.vue`：接入 `useJumpBack()`，透传 `jump-depth` / `@jump-back`；`gotoMark` 成功后调用 `refreshDepth()`（跳转已入栈）
4. i18n：`sidepanel.jumpBack` → zh-CN「返回跳转前位置」/ en「Back to pre-jump position」

## Verification

```bash
npm run typecheck
npm test
npm run lint
```
