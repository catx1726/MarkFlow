# 高亮恢复可信度分级与主动状态管理实施计划

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将高亮恢复从"被动弹窗确认"改造为"按可信度分支处理 + 侧边栏主动管理"，同时修复 L3 搜索的位置偏移问题。

**Architecture:**
1. **数据层**：Mark 接口扩展 `recoveryStatus` 字段。
2. **恢复层**：`HighlightRestorer` 按 confidence (high/medium/low) 分支处理，不再触发弹窗。
3. **表现层**：`Tooltip.vue` 支持 `pending-confirm` 模式；`Sidepanel.vue` 显示待恢复列表。
4. **交互层**：Content Script 支持 `recalibrate-mark` 消息，进入重新选择模式。

**Tech Stack:** Vue 3, TypeScript, WebExtension API, Rangy, webext-bridge.

---

### Task 1: 数据层扩展

**Files:**
- Modify: `src/logic/storage.ts`
- Modify: `src/logic/config.ts`

- [x] **Step 1: Mark 接口添加 recoveryStatus**
  ```typescript
  recoveryStatus?: 'restored' | 'pending-confirm' | 'needs-recalibration'
  ```

- [x] **Step 2: 新增 pending-confirm 样式常量**
  ```typescript
  export const highlightPendingConfirmStyle = (color: string) =>
    `box-shadow: inset 0 -5px 0 0 ${color}; cursor: pointer; border-bottom: 2px dashed ${color}; opacity: 0.85;`
  ```

---

### Task 2: 恢复逻辑改造（核心）

**Files:**
- Modify: `src/contentScripts/restorer.ts`
- Modify: `src/contentScripts/state.ts`

- [x] **Step 1: 扩展 SearchRestoreResult 接口**
  添加 `confidence?: 'high' | 'medium' | 'low'`

- [x] **Step 2: 改造 restoreBySearch 分支逻辑**
  - similarity ≥ 95% → `confidence: 'high'`，应用默认样式
  - similarity 85%-95% → `confidence: 'medium'`，应用 pending-confirm 样式
  - similarity < 85% → `confidence: 'low'`，不应用高亮
  - multiple candidates / no candidates → `confidence: 'low'`

- [x] **Step 3: 改造 applyMarksTwoPhases**
  - L1 成功 → `recoveryStatus: 'restored'`
  - high → `recoveryStatus: 'restored'`
  - medium → `recoveryStatus: 'pending-confirm'`
  - low → `recoveryStatus: 'needs-recalibration'`

- [x] **Step 4: 添加 persistRecoveryStatus 辅助方法**
  调用 `update-mark-details` 持久化 recoveryStatus，避免重复写入。

- [x] **Step 5: 移除弹窗触发逻辑**
  `restoreHighlights` 返回 `void`，不再处理 `ambiguousMarksQueue`。

- [x] **Step 6: state.ts 添加 recalibration 状态**
  ```typescript
  isRecalibrationMode = false
  recalibrationMarkId: string | null = null
  ```

---

### Task 3: 待确认标记交互

**Files:**
- Modify: `src/contentScripts/views/Tooltip.vue`
- Modify: `src/contentScripts/ui.ts`
- Modify: `src/contentScripts/index.ts`

- [x] **Step 1: Tooltip.vue 支持 pending-confirm 模式**
  - 新增 `mode` ref 和 `currentMarkId` ref
  - `show` 方法接收 `mode` 和 `markId` 参数
  - pending-confirm 模式下显示琥珀色提示条 + "位置正确"/"重新选择"按钮

- [x] **Step 2: ui.ts 添加 confirmPosition 和 recalibrate 处理**
  - `handleConfirmPosition`：恢复默认样式，更新 recoveryStatus
  - `handleRecalibrate`：进入重新选择模式

- [x] **Step 3: index.ts 点击现有高亮时传递 mode**
  - 检查 mark.recoveryStatus，若为 pending-confirm 则传递 mode='pending-confirm'

---

### Task 4: 重新选择模式

**Files:**
- Modify: `src/contentScripts/ui.ts`
- Modify: `src/contentScripts/index.ts`

- [x] **Step 1: ui.ts 实现 recalibration 模式**
  - `enterRecalibrationMode`：设置状态，显示页面顶部浮动提示
  - `exitRecalibrationMode`：清理状态，移除提示
  - `updateMarkFromRecalibration`：移除旧高亮，应用新高亮，更新 mark 数据

- [x] **Step 2: index.ts 处理 recalibrate-mark 消息**
  - 新增 `onMessage('recalibrate-mark', ...)` 处理器
  - `processSelection` 中 isRecalibrationMode 为 true 时，Alt+点击触发重新标记而非新建

---

### Task 5: 侧边栏待恢复列表

**Files:**
- Modify: `src/sidepanel/Sidepanel.vue`

- [x] **Step 1: 添加 pendingRecalibrationMarks 计算属性**
  从 `marksByUrl` 过滤所有 `recoveryStatus === 'needs-recalibration'` 的 mark。

- [x] **Step 2: 模板中添加待恢复区域**
  - 可折叠的琥珀色卡片，显示标记数量
  - 每个标记：原文片段 + "重新选择" + "丢弃"按钮

- [x] **Step 3: 实现 startRecalibration 方法**
  激活对应标签页，发送 `recalibrate-mark` 消息到 content script。

- [x] **Step 4: 实现 discardPendingMark 方法**
  调用 `remove-mark-by-id` 彻底删除标记。

---

### Task 6: L3 搜索修复（配套）

**Files:**
- Modify: `src/logic/search.ts`

- [x] **Step 1: 移除 div 从 structureBoundaries 查询**
  减少大容器 div 对搜索空间的过度过滤。

- [x] **Step 2: 添加回退机制**
  当 structureBoundaries 过滤死所有组合时，回退到纯相似度搜索。

- [x] **Step 3: 修复溢出 bug**
  - `suggestRange` 结果 clamp 到 `fullText` 长度
  - `LocalAligner` 的 `endMin` 防溢出

---

### Task 7: 测试与验证

**Files:**
- Modify: `src/tests/restorer.spec.ts`

- [x] **Step 1: 更新 restorer.spec.ts**
  `restoreHighlights` 返回 `void`，更新断言。

- [x] **Step 2: 运行全部测试**
  验证所有相关测试通过。

---

### Task 8: 文档与审计

**Files:**
- Modify: `.gemini/ops_changelog.md`
- Create: `docs/superpowers/specs/2026-06-10-recovery-status-management-design.md`
- Create: `docs/superpowers/plans/2026-06-10-recovery-status-management-plan.md`

- [x] **Step 1: 更新审计日志**
- [x] **Step 2: 创建 Spec 文档**
- [x] **Step 3: 创建 Plan 文档**

---

### Task 9: 分支与 PR

- [ ] **Step 1: 切换分支**
  `git checkout -b feat/recovery-status-management`

- [ ] **Step 2: 提交代码**
  按照 conventional commit 规范提交。

- [ ] **Step 3: 创建 PR**
  使用 PR Template，填写变更摘要和质量验证。
