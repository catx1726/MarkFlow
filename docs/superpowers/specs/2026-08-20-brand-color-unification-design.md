# Spec: 品牌色统一（扩展 UI blue → amber 琥珀橙）

**日期**: 2026-08-20
**状态**: 已批准（2026-08-20 Driver 确认），代码已实现，待视觉验收
**修订记录**: 初版方向为对齐宣传页 indigo；同日 Driver 二次决策改为 amber 琥珀橙（荧光笔隐喻，与高亮内容色同族），宣传页同步从 indigo 改为 amber。本文已按最终决策更新。
**来源需求**: `docs/NIT_ROADMAP.md` §3 "品牌色统一（扩展内 blue-600 → 宣传页 indigo）"
**生命周期**: Surgical Workflow（纯样式改动，无逻辑/数据模型变更，目标明确，范围 ≤12 文件）

---

## 1. 背景与问题

当前产品存在多套品牌色并存：

| 位置 | 当前主色 | 说明 |
| :--- | :--- | :--- |
| 宣传页 `docs/index.html` | indigo-600（18 处） | 已上线 GitHub Pages，是对外品牌门面 |
| 扩展 UI（popup/sidepanel/options/Tooltip） | blue-600（31 处）等 blue 系共 ~106 处 | 主按钮、聚焦环、链接色 |
| `src/styles/main.css` | teal-600（3 处） | vitesse 模板残留的 `.btn`/`.icon-btn`，基本未被使用 |

用户从宣传物料进入产品后看到的界面主色与宣传页不一致，产生品牌割裂感。

**最终决策（2026-08-20 Driver）**：不对齐 indigo，而是全产品（扩展 UI + 宣传页 + 图标）统一改为 **amber 琥珀橙**——荧光笔隐喻，与黄色高亮内容色同族，形成"看到界面色即联想到高亮"的意义闭环。

## 2. 目标 / 非目标

**目标**
- 扩展内与宣传页所有 blue/indigo 系品牌色按同明度映射替换为 amber 系
- 主按钮采用 amber-500 底 + gray-900 深字（对比度 3.2:1 → 8.4:1，荧光笔质感）
- 清理 `main.css` 中未被使用的 teal 残留样式与硬编码 blue hex
- 扩展图标 `#4285f4` → `#F59E0B`，重渲染各尺寸 PNG
- 构建通过，视觉回归无异常（对照截图人工确认）

**非目标（YAGNI）**
- ❌ 不改高亮标记色板（`#FFFF00` 黄/绿/红等）——那是用户内容色，不是品牌 UI 色
- ❌ 不引入主题切换开关、不做 i18n——分别为 Roadmap 独立条目

## 3. 色值映射规则

同明度一对一替换（Tailwind/UnoCSS 默认色板，色号不变只换色相）：

| 原 (blue/indigo) | 新 (amber) |
| :--- | :--- |
| *-50/100 | amber-50/100 |
| *-300/400 | amber-300/400 |
| *-500/600 | amber-500/600 |
| *-700~900 | amber-700~900 |

**对比度例外**：原 `bg-*-600 text-white` 主按钮（10 处）改为 `bg-amber-500 text-gray-900`，hover 用 amber-600；浅模式小字用 amber-700 满足 WCAG AA。

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
