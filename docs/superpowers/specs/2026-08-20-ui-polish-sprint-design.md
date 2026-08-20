# Spec: 界面视觉精修 Sprint（token 节律 / 层级减负 / 微交互）

**日期**: 2026-08-20
**状态**: 已批准（2026-08-20 Driver 确认，含 Shadow DOM px 约定澄清）
**来源需求**: `docs/NIT_ROADMAP.md` §3 "界面视觉精修 Sprint"（设计走查 2026-08-20）
**生命周期**: 标准生命周期（跨多组件的 UI 改动）；纯样式/呈现层，无逻辑与数据模型变更

---

## 1. 背景与问题

Issue #62 完成品牌色统一后，界面剩余"差一口气"的质感问题。设计走查确认的三个短板（附代码证据）：

1. **字号可读性**：Tooltip 标签区 6 处 `text-[10px]` 在宣传截图中不可读
2. **盒子里套盒子**：侧边栏三层嵌套各带 border+背景（`TagFolder` 文件夹卡 → `border-x border-b bg-gray-50` 容器 → `PageSection` 页面卡 `border shadow-sm` → 章节组），视觉噪音重
3. **微交互生硬**：Tooltip 弹出、文件夹展开均为瞬切（B 站演示素材直接受影响）

**重要设计约束（Driver 澄清 2026-08-20）**：`contentScripts/views/` 运行在 Shadow DOM 中，`rem` 单位会受宿主页 `<html>` font-size 影响，因此 Shadow DOM 内的 **px 任意值是刻意的反污染设计，禁止改为 rem 类**（如 `p-[12px]` 不可改 `p-3`）。扩展页面（sidepanel/popup/options）有独立 document 且 `main.css` 锁定 `html { font-size: 16px }`，不受此限，但为代码风格统一，本项目 px 写法同样保留。

## 2. 目标 / 非目标

**目标**（严格限定四项）
1. Tooltip 6 处 10px 小字提升至 12px（**保持 px 单位**，Shadow DOM 反 rem 污染约束）
2. 侧边栏嵌套层级减负：中间层去边框化，改"缩进 + 引导线"表达层级
3. Tooltip 弹出/收起过渡动画
4. 文件夹展开/收起过渡动画

**非目标（YAGNI）**
- ❌ 不改信息架构、组件结构、交互模型（三级树、收集箱、搜索保持不变）
- ❌ 不做全局语义色 token 大重构（gray-* 收敛留待后续，本期只治新增/改动处）
- ❌ 不动 Options 设置页（其版式合格）与 DisambiguationModal
- ❌ 不改任何逻辑/props/事件

## 3. 实施方案

### 3.1 字号可读性（仅 Tooltip.vue，6 处）

`text-[10px]` → `text-[12px]`（标签区小字、"MarkFlow"角标等）。**保持 px 单位**（Shadow DOM 约束，见 §1）。

间距不做改动：现有 px 值（12/8/24/6）本就在 4px/2px 网格上，符合节律。

### 3.2 侧边栏层级减负（2 个文件）

| # | 位置 | 当前 | 目标 |
|---|---|---|---|
| 1 | `TagFolder.vue:165` 文件夹内容容器 | `border-x border-b bg-gray-50 dark:bg-gray-800 rounded-b-lg` | 去边框去背景，改 `ml-3 pl-3 border-l-2 border-gray-200 dark:border-gray-700` 左侧引导线 |
| 2 | `PageSection.vue:81` 页面卡片 | `border shadow-sm` | 去 `shadow-sm`，保留细分隔线边框（`border` + `rounded-lg`），让卡片"浮"感减弱 |

层级表达变为：**文件夹行（实体行）→ 引导线缩进区 → 章节 amber 层级线 → 标记项**，边框总量减半。

### 3.3 Tooltip 弹出动画（Tooltip.vue）

根元素包 `<Transition>`：`fade + scale(0.96→1) + translateY(4px→0)`，150ms ease-out 进入 / 100ms ease-in 离开。与两阶段渲染（`visibility` 测量）兼容：Transition 只包显隐，不影响测量逻辑。

### 3.4 文件夹展开动画（TagFolder.vue）

`<details>` 原生展开改 CSS 增强：`details[open] > .folder-content` 应用 `fold-in` keyframes（opacity 0→1 + translateY(-4px→0)，150ms ease-out）。原生 `<details>` 无收起动画属已知限制，接受（YAGNI 不用 JS 手风琴重写）。

## 4. 风险与验证

**风险**
- `ml-3 pl-3 border-l-2` 引导线在深层嵌套（标签→页→章节）下累计缩进可能挤压内容宽度 → 验收时重点看三级展开态
- `<Transition>` 与 `visibility: hidden` 测量阶段叠加时首次进入动画可能闪烁 → 进入动画 delay 0，以 `isPositioned` 为 v-if 条件（定位完成才触发进入动画）

**验证（三层证据）**
- Layer 1：lint-staged 通过；`tsc --noEmit` 无新增错误
- Layer 2：`vitest run` 全量无新增失败；`npm run build` exit 0
- Layer 3：Driver 浏览器验收——侧边栏三级展开截图对比（前/后）、Tooltip 弹出动画、文件夹展开动画、深浅双主题

## 5. 回滚

`git revert` 对应 commit（纯样式，无数据迁移）
