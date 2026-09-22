# 跳转历史回退（Jump Back History）Design

## Goal

用户点击侧边栏标记跳转原文后，可一键回到跳转前位置；多级栈支持逐级回退，便于在多条标记间来回跳转比对。

## Approach

- **捕获**：content script 新增 `jumpHistory.ts`（内存态多级栈，随标签页生命周期）。`restorer.ts::scrollToMark` 在 `scrollIntoView` 之前调用 `jumpHistory.capture(element)`，记录 `window.scrollX/scrollY` + 目标元素所有可滚动祖先的 `scrollTop/scrollLeft`（存元素引用）。
- **恢复**：侧边栏 `SidepanelHeader` 工具栏新增「返回」按钮（内联 SVG 左箭头，样式对齐 new-tag/settings 按钮），向当前活动标签页发送 `jump-back`；content script 弹栈并 `scrollTo` 恢复（`behavior: 'auto'`，与跳转一致）。
- **状态同步**：侧边栏在发起跳转后、返回后、标签页激活变化时查询 `get-jump-history-depth` 刷新按钮可用态（深度 0 时禁用）。
- **协议**：`shim.d.ts` 新增 `'jump-back'`（fire-and-forget）与 `'get-jump-history-depth': ProtocolWithReturn<void, { depth: number }>`。
- **i18n**：`zh-CN.ts` / `en.ts` 新增 `sidepanel.jumpBack` 文案。

## References

- 跳转执行点： `src/contentScripts/restorer.ts:379-399` `scrollToMark`
- 消息注册： `src/contentScripts/index.ts:317-319`（`onMessage('goto-mark')`）
- 侧边栏发起： `src/sidepanel/composables/useMarkActions.ts:24-47` `gotoMark`
- 按钮样式参照： `src/sidepanel/components/SidepanelHeader.vue:59-90`

## Boundaries

- 仅同标签页跳转（`goto-mark` 路径）入栈；跨页新开标签的 hash 定位**不入栈、不支持返回**（已确认）
- 栈为内存态，页面刷新即清空，不持久化
- 「返回」本身不入栈；返回后再次点击标记会形成新栈层
- 记录的可滚动祖先已从 DOM 移除时（SPA 容器复用），退化为仅恢复 window 滚动位置
- 栈上限 50 层，防内存膨胀；超出丢弃最底层
- 改动文件预估 9 个（≤10），无数据模型/存储结构变更
