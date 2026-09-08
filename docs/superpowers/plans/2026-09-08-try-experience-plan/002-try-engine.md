# Task 002: try.js 模拟引擎（标记/标签/侧栏/回跳/重置）

## Context

页面 A 骨架已就位。本 task 产出完整模拟引擎 `docs/try/try.js`（vanilla JS，约 350 行，单文件按职责分模块）。保真对齐表见 Spec §技术方案。

## Target Logic

### 模块划分（单文件内按注释分节）

| 模块 | 职责 | 关键契约 |
| :--- | :--- | :--- |
| `store` | localStorage 读写 | 键 `markflow-try-marks`；结构 `Record<pageId, Mark[]>`；`pageId` 取自 `<body data-page>`（`a`~`e`） |
| `anchor` | 定位与校验 | Mark 锚点 `{paraIdx, start, end}`；恢复时校验 `para.textContent.substring(start,end) === text`，失败该条侧栏置灰不渲染标记 |
| `render` | 标记包裹 | TreeWalker 收集 Range 内文本节点 → 逐段 `splitText` 包 `<span class="mark" data-mid>`；内联样式 = `box-shadow: inset 0 -5px 0 0 <color>; padding-bottom: 5px` |
| `tooltip` | 创建/管理 | 新建：5 色圆点 + 已有标签 chips（可多选）+ 新建标签输入 + 「保存」；点击色点即创建（与落地页文案一致）。已有标记：仅「删除」。选区上方定位，150ms 弹入 |
| `sidebar` | 两级分组渲染 | 标签（无标签入「未归类」）→ 页面（A~E 标题）→ 条目（色点 + 文本摘要 + hover 删除 ×）；空态 mono 小字「按住 Alt 选中文字，即可标记」 |
| `jump` | 回跳 | 本页：`scrollIntoView({block:'center'})` + `box-shadow` 过渡 `#fbbf24`，1000ms 后还原原色；跨页：`location.href = <page>.html#mark-<id>`；加载时检测 hash → 延迟 100ms 滚动+脉冲 → `history.replaceState` 清 hash |
| `hint` + `reset` | 引导与重置 | 首访提示条（可关闭）；侧栏底部「重置体验」清键并刷新 |

### 关键判定（对齐扩展）

- 触发：`mouseup` 且 `event.altKey` 且 `!selection.isCollapsed`（对齐 `index.ts:191`）
- 重叠拒绝：选区 Range 与任一 `[data-mid]` 相交（`range.intersectsNode`）→ 不创建，选区旁显示一行提示「暂不支持重叠标记」
- 安全：标签名与摘要渲染一律 `textContent` 赋值（BLOCKING）
- `id`：`m` + `Date.now().toString(36)` + 4 位随机

## Verification

```bash
node --check docs/try/try.js   # exit 0
# 手工（仅 A 页，http://localhost:8000/try/）：
# 1. Alt+划词 → Tooltip 出现 → 点黄色 → 文本出现 5px 黄色底条；侧栏即时新增条目
# 2. 带标签「节奏」再标一条 → 侧栏按标签分组正确
# 3. 点击侧栏本页条目 → 滚动居中 + 琥珀脉冲 1s 后还原
# 4. 刷新页面 → 标记恢复（位置正确）；点已有标记 → 删除生效
# 5. 划词与已有标记重叠 → 拒绝并提示
# 6. 重置体验 → localStorage 清空、页面干净
```
