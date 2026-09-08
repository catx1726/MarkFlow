# 体验页与落地页补充「标记备注」设计

**状态**: 已批准（2026-09-08 Driver 确认范围：侧栏只读展示、落地页只加步骤 1 + 图注）
**Issue**: #85（#83 / PR #84 的后续补充）

> **修订 1**: 2026-09-08 Driver 走查反馈——①tooltip 的 textarea 无法点击输入（`mousedown preventDefault` 一刀切阻止了聚焦默认行为，修复：放行输入控件）；②tooltip 布局偏离扩展实际代码（修复：对齐 Tooltip.vue 卡片式布局——w320 卡片 + 色板行「点击仅选中」+ MarkFlow 字标 + min-h-80 textarea + 复制/删除/保存按钮行，替代原 hairline 极简风格；`color-dot` CSS 随之废弃移除；Alt+S 语义从「默认色直接保存」改为「等同点击确认高亮」，与扩展 `selectedColor` 语义对齐；说明弹窗文案同步更新）。

## 1. 背景

PR #84 录屏走查发现遗漏：体验页组 `docs/try/` 与落地页都没有覆盖扩展的**标记备注**能力。扩展真实行为（SSOT）：

- 创建：Tooltip 含备注输入框（`src/contentScripts/views/Tooltip.vue:377-379`，placeholder「在这里记录你的笔记或思考...」），随颜色一起保存（`ui.ts:288` `handleSave(note, color, tags)`）
- 管理：点击已有标记，Tooltip 带出已有备注可改回存（`index.ts:285-289`）
- 侧栏：`MarkItem.vue:152` 展示备注或「点击添加备注...」；备注参与搜索/复制（`标记：…\n备注：…`）/Markdown 导出（`**备注：**`，`useMarkActions.ts:89,118`）

## 2. 目标

- 体验页补备注闭环：创建时可写备注 → 侧栏展示 → 点击标记可改 → 刷新后仍在
- 落地页文案补备注（zh+en）
- 录屏重录前功能完整

## 3. 非目标（Driver 已裁）

- ❌ 侧栏行内编辑备注（编辑走「点击标记 → 管理气泡」路径，与扩展主交互一致）
- ❌ 落地页 hero 改动（保持两行极净）
- ❌ 备注参与搜索/导出等扩展高级能力（体验页无搜索/导出）

## 4. 设计

### try.js 引擎

| 模块 | 改动 | SSOT |
| :--- | :--- | :--- |
| Mark 模型 | 加 `note: string`（默认 `''`） | `storage.ts:58,85` |
| 创建气泡 `openCreate` | 色点行下加 `<textarea>`（placeholder 复用「在这里记录你的笔记或思考...」）；`createMark(color)` 读取当前值存入 | `Tooltip.vue:377-379` |
| 快捷保存 Alt+S | 读取 textarea 当前值一并保存（对齐扩展：`emit('save', noteValue.value, ...)`，`Tooltip.vue:169`） | `Tooltip.vue:169` |
| 管理气泡 `openManage` | 备注 textarea 预填 `mark.note` + 「保存备注」按钮（回写 storage + 重渲侧栏）；删除按钮不变 | `index.ts:285`、`ui.ts:288` |
| 侧栏 `markItem` | 有备注时片段下加一行 `text-xs text-neutral-400 truncate` 只读展示 | `MarkItem.vue:152`（仅展示，不做行内编辑） |

存储：`localStorage['markflow-try-marks']` 的 Mark 记录直接多一个 `note` 字段，旧数据无该字段按 `''` 处理（读取兜底），无需迁移。

### 4 页 HTML

说明弹窗「核心功能」列表加「备注」条目：创建或点击标记时，可在气泡中为它写下想法。

### 落地页（zh + en 同步）

- 使用步骤 1 主句：「按住 Alt 选中文字，选择颜色。」→「按住 Alt 选中文字，选择颜色，记下想法。」（EN 同步）
- 演示 GIF 图注：「标记、归类、回跳。」→「标记、备注、归类、回跳。」（EN 同步）
- hero、meta、其余步骤不动

## 5. 验证（Playwright + 系统 Chrome）

1. 创建标记时填写备注 → 侧栏出现备注行
2. 空备注创建 → 侧栏无备注行（不渲染空行）
3. 点击标记 → 管理气泡预填备注 → 改写保存 → 侧栏更新
4. Alt+S 快捷保存带上已输入备注
5. 刷新后备注仍在
6. 落地页 zh/en 步骤 1 与图注文案断言
7. 回归：既有套件（21 + 10 + 10）全绿；eslint 0 错误；`node --check try.js`
