# Spec: Tooltip 选区感知定位 + Header 拖拽

**日期**: 2026-08-20
**状态**: 已批准（2026-08-20 Driver 确认），代码已实现，待视觉验收
**来源需求**: `docs/NIT_ROADMAP.md` §3 "Tooltip 选区感知定位 + 可拖拽"（用户需求 2026-08-20）
**生命周期**: Surgical Workflow（范围 ≤4 文件、目标明确、无架构变更；定位算法提取为纯函数并配单元测试）
**Brainstorming 决策记录**（Driver 已确认）：
1. 定位基准 = **选区感知定位**（Range 矩形，非鼠标坐标）
2. 拖动位置 = **不记忆**，每次弹出重新智能计算
3. 拖拽区域 = **仅顶部 header**

---

## 1. 背景与问题

当前 Tooltip 定位逻辑（`Tooltip.vue` `show()`）：

- 位置直接取鼠标事件的 `clientX/clientY`（新建标记在 `index.ts:230` 传 mouseup 坐标；已有标记在 `ui.ts:268` 透传点击坐标）
- 仅做视口边界钳制（margin），宽高硬编码 `320×340`
- **问题**：鼠标松开点就在选中文字末尾，tooltip 弹出后直接盖住选区或其上下文，用户无法边写笔记边对照原文

## 2. 目标 / 非目标

**目标**
- Tooltip 弹出位置以**选区矩形**为基准，默认不遮挡选中文本
- 支持按住 header 拖拽移动，拖拽范围钳制在视口内
- 定位基于 tooltip **实际渲染高度**（顺带解决 Roadmap 中 `tooltipHeight=340` 硬编码条目）

**非目标（YAGNI）**
- ❌ 不记忆拖动位置（每次弹出重新计算）
- ❌ 不改动 `DisambiguationModal` 的定位
- ❌ 不支持拖拽到页面级持久化/跨设备同步
- ❌ 卡片边缘/四角不作为拖拽区

## 3. 行为规则

### 3.1 智能定位算法（纯函数）

提取为 `src/logic/tooltipPosition.ts`：

```ts
interface Rect { top: number; left: number; width: number; height: number }

function computeTooltipPosition(
  anchor: Rect,          // 选区 bounding rect（viewport 坐标）
  tooltip: { width: number; height: number },  // 实际渲染尺寸
  viewport: { width: number; height: number },
  margin = 8,
  gap = 8,               // 与选区间距
): { x: number; y: number }
```

规则（按优先级）：

| 优先级 | 条件 | 位置 |
| :--- | :--- | :--- |
| 1 | 选区下方可容纳（`anchor.bottom + gap + height ≤ viewport.height - margin`） | 下方：`y = anchor.bottom + gap` |
| 2 | 上方可容纳（`anchor.top - gap - height ≥ margin`） | 上方：`y = anchor.top - gap - height` |
| 3 | 上下均不足（如超高选区/矮视口） | 选剩余空间较大的一侧，钳制进视口 |

- **水平方向**：`x = clamp(anchor.left, margin, viewport.width - width - margin)`（左对齐选区起点）
- 任何分支结果均最终过一遍视口钳制，保证不溢出

### 3.2 实际高度测量

`show()` 改为两阶段渲染：
1. 设置内容后以 `visibility: hidden` 挂载 → `nextTick` → 读取 `el.getBoundingClientRect()` 得实际宽高
2. 调 `computeTooltipPosition` 计算 → 写入 `position` → 移除 `visibility: hidden`

避免硬编码 340 在标签多/textarea 撑高时溢出。

### 3.3 调用链传参变更

| # | 位置 | 当前 | 目标 |
|---|---|---|---|
| 1 | `src/logic/tooltipPosition.ts` | — | **新建**：`computeTooltipPosition` 纯函数 |
| 2 | `src/contentScripts/index.ts:230`（新建标记） | 传 `event.clientX/Y` | 改传 `range.nativeRange.getBoundingClientRect()`（需确认 rangy Range 的 nativeRange 访问方式，fallback：`rangy.getSelection().getRangeAt(0).getBoundingClientRect()`） |
| 3 | `src/contentScripts/index.ts:273`（已有标记点击） | 传点击 `x, y` | 改传被点击高亮元素的 `getBoundingClientRect()` |
| 4 | `src/contentScripts/ui.ts:264` `showTooltip` | 签名 `(x, y, ...)` | 签名改为 `(anchorRect: Rect, ...)`，透传 |
| 5 | `src/contentScripts/views/Tooltip.vue` `show()` | 硬编码 320×340 + margin 钳制 | 两阶段渲染 + 调纯函数 |

### 3.4 Header 拖拽（Tooltip.vue 内部）

- **触发区**：`.tooltip-header` 行中"MarkFlow"文字及其空白区（色板、按钮排除），hover 时 `cursor: move`
- **实现**：`pointerdown` 记录 `(pointerClient - position)` 偏移 → `window` 上挂 `pointermove`/`pointerup`（`setPointerCapture` 可选）→ 移动中实时更新 `position` 并做视口钳制 → `pointerup` 解绑
- **细节**：
  - 拖拽期间 `user-select: none` + `preventDefault()`，防止拖出页面选区
  - 拖拽不触发 hide（现有 `@mousedown.stop`/`@mouseup.stop` 保留，确保不冒泡到页面的"点击空白关闭"逻辑）
  - Escape 关闭、快捷键等现有行为不变

## 4. 风险与验证

**风险**
- **Shadow DOM 坐标系**：Tooltip 挂在 Shadow Root 内但定位用 `fixed`（viewport 坐标），`getBoundingClientRect()` 同样是 viewport 坐标，**无需坐标转换**；需验证 `uiRoot` 容器没有 `transform`/`filter` 等会改变 fixed 定位上下文的样式（经初查容器仅 `position: fixed`，无 transform）
- **rangy Range 的 rect 获取**：rangy 包装对象取原生 rect 的 API 需在实现时验证，已列 fallback
- **多行选区**：`getBoundingClientRect()` 返回整个选区的外包矩形，整页选中时矩形接近视口大小 → 落入规则 3（选空间大的一侧钳制），行为可接受
- **iframe**：content script 注入 iframe 时 rect 均为当前 frame 视口坐标，一致

**验证（三层证据）**
- Layer 1：`pnpm lint` + `pnpm typecheck` 0 errors
- Layer 2：`pnpm test` 通过——**新增 `tooltipPosition.spec.ts`**，覆盖：下方优先 / 上方翻转 / 上下均不足取大侧 / 水平左右钳制 / 紧贴视口边缘
- Layer 3：`pnpm dev` 人工验证：
  - 页面顶部/中部/底部各划词一次，确认不遮挡选区
  - 多行选区、整段选中场景
  - header 拖拽到视口四角不溢出；拖拽中不误触页面文本选择
  - 点击已有标记弹出的定位同样生效

## 5. 回滚

`git checkout HEAD -- src/`
