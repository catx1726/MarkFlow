# 设计规约：高亮恢复可信度分级与主动状态管理

- **状态**：已评审
- **日期**：2026-06-10
- **关联 Issue**：[#47](https://github.com/catx1726/MarkFlow/issues/47)

## 1. 目标 (Goals)

解决当前恢复机制的两大核心问题：

1. **被动弹窗体验差**：L4 歧义消除弹窗让用户在模糊的候选列表中被动选择，仿佛机器已帮用户"预选"了错误位置。
2. **位置偏移不可信**：L3 共识搜索在复杂 DOM 场景下返回的 range 可能偏移，直接应用会导致高亮飘到错误位置。

通过引入**可信度分级**和**恢复状态持久化**，将恢复从"机器猜测 → 弹窗确认"改为"按可信度分支处理 + 侧边栏主动管理"。

## 2. 方案详述 (Detailed Design)

### 2.1 可信度分级策略

| 等级 | 条件 | 处理方式 | 视觉表现 |
|------|------|----------|----------|
| **High** (≥95%) | L1 路径还原成功 或 L3 相似度 ≥95% | 自动恢复，静默成功 | 默认样式（box-shadow 下划线） |
| **Medium** (85%-95%) | L3 相似度 85%-95% | 自动恢复，但标记为"待确认" | 虚线边框 + 半透明 + 提示图标 |
| **Low** (<85%) | L3 相似度 <85% / 无候选 / 多候选 | 不自动恢复，进入待恢复列表 | 无高亮，侧边栏显示"待恢复" |

### 2.2 恢复状态持久化

在 `Mark` 数据结构中新增 `recoveryStatus` 字段：

```typescript
recoveryStatus?: 'restored' | 'pending-confirm' | 'needs-recalibration'
```

- 状态自描述：mark 数据本身携带恢复状态，无需 content script 维护额外队列。
- 状态流转：
  - 新建标记 → 默认为 `undefined`（向后兼容，视为 `'restored'`）
  - High 恢复成功 → `'restored'`
  - Medium 恢复成功 → `'pending-confirm'`
  - Low 恢复失败 → `'needs-recalibration'`
  - 用户确认 pending-confirm → `'restored'`
  - 用户重新选择 → `'restored'`

### 2.3 侧边栏"待恢复"列表

在侧边栏 TagFolder 列表**上方**新增可折叠区域：

- 标题：⚠️ 待恢复标记 (N)
- 每个标记显示：原文片段（截断）+ "重新选择"按钮 + "丢弃"按钮
- 点击"重新选择"：激活对应标签页，发送 `recalibrate-mark` 消息到 content script

### 2.4 重新选择模式 (Recalibration Mode)

当用户从侧边栏触发重新选择时，content script 进入特殊模式：

1. 页面顶部显示浮动提示："请选中原标记「xxx」对应的文本，然后按 Alt+点击确认"
2. 用户选中文本后按 Alt+点击（与新建标记相同手势）
3. 系统不创建新 mark，而是更新现有 mark 的 text/rangySerialized/html/context/recoveryStatus
4. 退出重新选择模式

### 2.5 待确认标记的确认交互

当用户点击 `pending-confirm` 样式的高亮时：

1. Tooltip 显示琥珀色提示条："此标记位置可能已变化，请确认是否准确"
2. 提供两个按钮：
   - **位置正确**：将样式恢复为默认，更新 `recoveryStatus` 为 `'restored'`
   - **重新选择**：进入重新选择模式

### 2.6 L3 搜索修复（配套改进）

本次改造同时修复了导致位置偏移的根因：

- `structureBoundaries` 过滤过度：从查询列表中移除 `div`，减少不必要的边界干扰
- 回退机制：当 structureBoundaries 过滤死所有搜索路径时，自动回退到纯相似度搜索
- `suggestRange` 和 `LocalAligner` 的溢出保护

## 3. 技术实现 (Technical Implementation)

### 3.1 关键代码改动

| 文件 | 改动 |
|------|------|
| `src/logic/storage.ts` | Mark 接口添加 `recoveryStatus` |
| `src/logic/config.ts` | 新增 `highlightPendingConfirmStyle` |
| `src/contentScripts/restorer.ts` | 恢复逻辑按 confidence 分支；移除弹窗触发 |
| `src/contentScripts/state.ts` | 添加 `isRecalibrationMode` / `recalibrationMarkId` |
| `src/contentScripts/ui.ts` | 添加 `enterRecalibrationMode` / `updateMarkFromRecalibration` / `handleConfirmPosition` |
| `src/contentScripts/index.ts` | `processSelection` 支持 recalibration；tooltip 传递 mode |
| `src/contentScripts/views/Tooltip.vue` | 新增 `pending-confirm` 模式 UI |
| `src/sidepanel/Sidepanel.vue` | 新增"待恢复标记"区域 |

### 3.2 消息流

```
Sidepanel --recalibrate-mark--> Content Script --update-mark-details--> Background
                                                                  |
                                                                  v
                                                           Storage (recoveryStatus)
```

### 3.3 向后兼容

- 旧数据没有 `recoveryStatus` 字段 → 恢复时按现有逻辑处理，成功后写入 `'restored'`
- `DisambiguationModal.vue` 保留文件但不再被调用（Phase 6 可彻底移除）

## 4. 测试策略

| 测试类型 | 内容 |
|----------|------|
| 单元测试 | restorer.spec.ts 更新：验证 confidence 返回值和 recoveryStatus 更新 |
| 集成测试 | cross-element.spec.ts, li_deletion.spec.ts：验证各场景下的恢复行为 |
| 手动测试 | 删除 li → 观察待恢复列表；修改少量文字 → 观察 pending-confirm 样式 |

## 5. 风险与对策

| 风险 | 对策 |
|------|------|
| 旧用户数据无 recoveryStatus | 视为 undefined，恢复成功后自动写入 |
| 重新选择模式与新建标记手势冲突 | Recalibration 模式下优先处理重新标记 |
| 待确认样式与页面背景冲突 | 使用虚线边框 + 透明度 + 琥珀色提示，区分度足够 |
