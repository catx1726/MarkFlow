# Task 005: 范围修订（Driver 指令 2026-09-08）

## Context

Task 001-004 完成后，Driver 提出范围变更（见 Spec 修订记录）：移除标签功能、移除 E 页、新增快捷键与说明弹窗、侧栏改为页面文件夹层级。另 Driver 指出侧栏文件夹应以网页标题命名（对齐扩展 PageSection 行为），非泛指代号。

## Current Logic → Target Logic

| 项 | 变更 | 源代码参考 |
| :--- | :--- | :--- |
| 标签 | Tooltip 标签 chips/输入、侧栏标签分组全部移除；Mark 结构去 `tags` | ——（功能移除） |
| 快捷标记 | 气泡打开时 `Alt+S` 以默认色（黄 `#FFFF00`）保存；`event.code` 判定 | `settings.ts:13`、`Tooltip.vue:141-145` |
| 快捷删除 | 已有标记气泡打开时 `Alt+D` 删除 | `settings.ts:14`、`Tooltip.vue:146-150` |
| 说明弹窗 | 导航「说明」按钮 → 遮罩 + hairline 卡片（零阴影），四行：标记/跳转/快捷标记/快捷删除；Esc/遮罩/关闭按钮关闭 | 浮层样式对齐自有页面质感规范 |
| 层级管理 | 侧栏 = 页面文件夹（chevron ▸/▾ 折叠，PageSection 模式简版），组内按 `(paraIdx,start)` 物理排序；当前页文件夹琥珀色 | `PageSection.vue` 折叠；`tagTree.ts:88-92` domIndex 排序 |
| 文件夹命名 | Mark 创建时记录 `title`（`body[data-title]`），文件夹取首个有 title 标记的标题 | `ui.ts:415`、`tagTree.ts:47` |
| E 页 | 删除 `docs/try/e.html`；四页页签 A~D；A 页导语「共五页」→「共四页」 | —— |

## Verification

Playwright 自动化（系统 Chrome，`try-v2` 套件）**20/20 PASS**：

- 标签移除（Tooltip 无输入框、侧栏无标签分组）
- Alt+S 快捷标记（默认黄，计算样式逐值比对）/ Alt+D 快捷删除
- 说明弹窗（四功能齐备 / Esc / 遮罩关闭）
- 页面文件夹（标题命名「让内在来指挥 · 2」/ 计数 / 折叠 chevron / 当前页琥珀）
- 跨页回跳回归（D → A hash 跳转 + 琥珀脉冲 + hash 清除）
- 刷新恢复 + 组内物理排序 + 重置清空
