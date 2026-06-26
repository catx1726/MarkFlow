---
spec_id: SPEC-2026-06-26-001
title: MarkFlow 恢复算法简化与标记样式自定义
date: 2026-06-26
status: draft
---

# MarkFlow 恢复算法简化与标记样式自定义

## 1. 背景与目标

根据 `.temp/detail.md` 中的需求，本次改动聚焦三点：

1. **简化恢复算法**：当页面发生较大变化时，不再通过共识重构（Level 3）或歧义消除 UI（Level 4）帮用户恢复高亮位置；改为在侧边栏给出上下文提示，帮助用户回忆原文。
2. **高亮高度自定义**：在设置页增加选项，控制高亮下划线（`box-shadow`）的厚度。
3. **高亮边距控制**：为高亮标记添加与高度相等的 `padding-bottom`，避免下划线紧贴文字。

## 2. 需求范围

### 2.1 恢复算法层级处理

| 层级 | 名称 | 处理方式 | 原因 |
| :--- | :--- | :--- | :--- |
| Level 1 | 路径还原 | **保留** | 性能最优，页面未变化时可无感恢复 |
| Level 2 | 内容对齐（精确/正则搜索） | **保留** | 内容未变但路径失效时仍可恢复 |
| Level 2.5 | 全局回退搜索 | **保留** | 处理虚拟列表容器复用导致的局部失效 |
| Level 3 | 共识重构 | **跳过** | 页面大幅变化时容易出错，不再自动恢复 |
| Level 4 | 歧义消除 UI | **跳过** | 用户手动确认成本高，改为侧边栏提示 |

> **原则：跳过而非删除。** 相关类与组件保留在代码库中，通过最小化的条件控制暂时停用，以便未来需要时快速恢复。

### 2.2 恢复失败状态

- 新增字段 `Mark.restoreFailedAt?: number`，记录最近一次恢复失败的时间戳。
- 当 Level 1/2/2.5 全部失败时，`HighlightRestorer` 调用 `update-mark-details` 写入 `restoreFailedAt`。
- 当某次恢复成功时，清除该字段（设置为 `null`）。

### 2.3 侧边栏上下文提示

- `MarkItem.vue` 检测到 `restoreFailedAt` 存在时，显示轻量提示徽章（例如「原位置已变化」）。
- 用户可点击/展开查看保存的上下文信息：`contextTitle`（章节标题）和 `surroundingSnippet`（前后文本片段）。
- 提示不会阻塞任何操作，仅作为辅助信息。

## 3. 高亮样式自定义

### 3.1 设置项

- 在 `defaultSettings` 中新增 `highlightHeight: number`，默认值为 `5`。
- 在 Options 页面新增「高亮标记高度」设置项，使用滑块或数字输入，范围 `1–20`。
- 用户看到的值为正数（px），实际生成的 `box-shadow` 使用负值。

### 3.2 样式生成

`highlightDefaultStyle(color, height)` 返回：

```css
box-shadow: inset 0 -{height}px 0 0 {color};
padding-bottom: {height}px;
cursor: pointer;
```

其中 `height` 取 `settings.value.highlightHeight`。

### 3.3 运行时同步

- 创建新标记、预览高亮、恢复高亮、滚动定位动画均使用当前 `highlightHeight`。
- Options 页面保存设置后，向所有 content script 广播 `refresh-highlights`，使已打开页面的高亮样式立即更新。

## 4. 最小侵入边界

为控制变更范围，本次改动遵循以下原则：

1. **不删除文件**：`DisambiguationModal.vue`、`ListItemComponent.vue`、`search.ts` 中的共识相关类均保留。
2. **不删除函数**：`restoreBySearch`、`addToAmbiguousQueue` 等保留，仅修改调用分支。
3. **不修改数据结构核心字段**：仅新增可选字段 `restoreFailedAt`。
4. **集中条件控制**：所有"跳过"逻辑通过少量布尔判断或数组过滤实现，便于未来还原。

## 5. 测试策略

1. **单元测试**：
   - 更新 `search.spec.ts`：移除或跳过依赖 `ConsensusMatchStrategy` 的用例，保留精确/正则搜索用例。
   - 更新 `restorer.spec.ts`：验证恢复失败时会写入 `restoreFailedAt`。
   - 更新 `ui.spec.ts`：保留现有基础测试，移除弹窗相关断言。
   - 新增/更新 `settings.spec.ts`：验证 `highlightDefaultStyle` 根据高度生成正确样式。

2. **类型检查**：`pnpm typecheck`
3. **Lint**：`pnpm lint`
4. **测试套件**：`pnpm test`

## 6. 不在本次范围内

- 不重构 `search.ts` 的整体结构。
- 不修改同步、标签、导出等无关模块。
- 不引入新的存储键，失败状态复用 `update-mark-details`。

## 7. 风险与回滚

- **风险**：如果未来想恢复 Level 3/4，需要还原 `search.ts` 中的策略数组和 `restorer.ts` 中的分支判断。
- **回滚**：由于改动集中在少量条件判断上，可通过 revert 单个 commit 快速回滚。

## 8. 验收标准

- [ ] Level 3 `ConsensusMatchStrategy` 不再被 `findCandidateElements` 调用。
- [ ] 歧义选择弹窗不再弹出。
- [ ] 恢复失败时，`Mark.restoreFailedAt` 被写入且侧边栏显示提示。
- [ ] 设置页可调整高亮高度，保存后已打开页面高亮样式刷新。
- [ ] `box-shadow` 与 `padding-bottom` 值始终相等且为正数显示。
- [ ] `pnpm lint`、`pnpm typecheck`、`pnpm test` 全部通过。
