# Spec: 品牌色统一（扩展 UI blue → 宣传页 indigo）

**日期**: 2026-08-20
**状态**: 已批准（2026-08-20 Driver 确认），代码已实现，待视觉验收
**来源需求**: `docs/NIT_ROADMAP.md` §3 "品牌色统一（扩展内 blue-600 → 宣传页 indigo）"
**生命周期**: Surgical Workflow（纯样式改动，无逻辑/数据模型变更，目标明确，范围 ≤12 文件）

---

## 1. 背景与问题

当前产品存在三套品牌色并存：

| 位置 | 当前主色 | 说明 |
| :--- | :--- | :--- |
| 宣传页 `docs/index.html` | **indigo-600**（18 处） | 已上线 GitHub Pages，是对外品牌门面 |
| 扩展 UI（popup/sidepanel/options/Tooltip） | **blue-600**（31 处）等 blue 系共 ~106 处 | 主按钮、聚焦环、链接色 |
| `src/styles/main.css` | **teal-600**（3 处） | vitesse 模板残留的 `.btn`/`.icon-btn`，基本未被使用 |

用户从小红书/B 站/Reddit 的宣传物料（indigo 紫）点进产品后看到的是蓝色界面，产生"不是同一个产品"的品牌割裂感。

## 2. 目标 / 非目标

**目标**
- 扩展内所有 blue 系品牌色按同明度映射替换为 indigo 系（与宣传页一致）
- 清理 `main.css` 中未被使用的 teal 残留样式
- 构建通过，视觉回归无异常（对照截图人工确认）

**非目标（YAGNI）**
- ❌ 不改宣传页 `docs/index.html`（它已是 indigo，是本次对齐的基准）
- ❌ 不改扩展图标 `assets/icon.svg`（#4285f4）——图标是商店识别资产，换色影响已上架识别度，是否跟进由 Driver 另行决策
- ❌ 不改高亮标记色板（`#FFFF00` 黄/绿/红等）——那是用户内容色，不是品牌 UI 色
- ❌ 不引入主题切换开关、不做 i18n——分别为 Roadmap 独立条目

## 3. 色值映射规则

同明度一对一替换（Tailwind/UnoCSS 默认色板，色号不变只换色相）：

| 原 (blue) | 新 (indigo) | 出现次数 |
| :--- | :--- | :--- |
| blue-100 | indigo-100 | 4 |
| blue-300 | indigo-300 | 8 |
| blue-400 | indigo-400 | 15 |
| blue-500 | indigo-500 | 20 |
| blue-600 | indigo-600 | 31 |
| blue-700 | indigo-700 | 18 |
| blue-800 | indigo-800 | 3 |
| blue-900 | indigo-900 | 6 |

## 4. 实现改动点

| # | 文件 | blue 处数 | 改动 |
|---|---|---|---|
| 1 | `src/options/Options.vue` | 29 | blue-* → indigo-* |
| 2 | `src/contentScripts/views/Tooltip.vue` | 20 | 同上 |
| 3 | `src/sidepanel/components/SidepanelHeader.vue` | 14 | 同上 |
| 4 | `src/sidepanel/Sidepanel.vue` | 10 | 同上 |
| 5 | `src/contentScripts/views/DisambiguationModal.vue` | 10 | 同上 |
| 6 | `src/logic/i18n.ts` | 10 | 同上（GitHub 同步帮助文案内联样式） |
| 7 | `src/sidepanel/components/MarkItem.vue` | 6 | 同上 |
| 8 | `src/popup/Popup.vue` | 4 | 同上 |
| 9 | `src/contentScripts/views/App.vue` | 2 | 同上 |
| 10 | `src/sidepanel/components/StorageManager.vue` | 1 | 同上 |
| 11 | `src/contentScripts/views/ListItemComponent.vue` | 1 | 同上 |
| 12 | `src/styles/main.css` | 3 teal | `.btn` 无任何引用 → 删除；`.icon-btn` 被 `src/components/Logo.vue` 引用 → teal 改 indigo |

**替换方式**：逐文件 `blue-` → `indigo-` 字面替换（UnoCSS class 含 `dark:`/`hover:` 等变体前缀，词根替换安全）。替换后用 `grep -rn "blue-" src/` 验证零残留。

## 5. 风险与验证

**风险**
- `text-blue-*`/`bg-blue-*`/`ring-blue-*`/`border-blue-*` 均为词根替换，无遗漏风险；需人工确认不存在 `blue` 作为语义色（如"信息提示蓝"）的场景——经初查均为品牌主色用途
- ~~`.btn` 引用确认~~ 已查证：`.btn` 零引用可直接删；`.icon-btn` 仅 `Logo.vue` 一处引用，改色即可

**验证（三层证据）**
- Layer 1：`pnpm lint` + `pnpm typecheck` 0 errors
- Layer 2：`pnpm build` exit 0；`pnpm test` 全通过（样式改动不应影响测试）
- Layer 3：`pnpm dev` 加载扩展，对照以下界面人工截图比对：popup / sidepanel（含搜索、标签、存储管理器）/ options 各 section / 划词 Tooltip（浅色+深色各一）

## 6. 回滚

`git checkout HEAD -- src/`（纯样式改动，无数据迁移）
