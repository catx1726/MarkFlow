# 自有页面质感对齐设计（扩展 UI → 宣传页布列松风）

> **修订记录**:2026-09-07 初版范围 = Popup + Sidepanel + 清理（Driver 三选确认）；同日 Driver 追加范围扩展——Options 页同步对齐（`Options.vue` 48 处 gray→neutral、3 处去阴影、3 处 rounded-lg→md、导航卡与 setting-card 补 hairline 边框、`options/index.html` 1 处），全部自有页面至此完成统一。

## Goal

将 Popup 与 Sidepanel 的界面质感对齐宣传页 `docs/index.html` 的布列松式语言：中性色板统一为 neutral、去除阴影、圆角收敛，品牌琥珀色与卡片布局保持不变。

## Approach

1. **色板映射**：`gray-*` → `neutral-*` 同明度词根替换（沿用 2026-08-20 品牌色统一 Spec 的机械替换法），共 84 处分布于 7 个 Vue 文件；`src/styles/main.css` 的滚动条/代码块 token 改为 neutral 等价色值。
2. **去阴影**：移除范围内全部 9 处 `shadow-*`（按钮 shadow-sm ×2、下拉菜单 shadow-lg ×4、模态 shadow-xl ×2、存储卡 shadow-lg ×1）；下拉菜单与模态已有实底 + border + 遮罩，层级表达不依赖阴影。
3. **圆角收敛**：`rounded-lg` → `rounded-md`（7 处：卡片/容器），`rounded-md` 及以下不动。
4. **清理**：删除 `unocss.config.ts` 中零引用的死 token（`brand.blue`/`brand.red`/`border-color`）。

## References

- 参考设计：`docs/index.html`（hairline、neutral 色板、零阴影、唯一琥珀强调）
- 参考先例：`docs/superpowers/specs/2026-08-20-brand-color-unification-design.md`（同明度词根替换法）
- 高亮形态 SSOT：`src/logic/config.ts::highlightDefaultStyle()`（5px 底部色条，与宣传页 mark-stroke 同构，不在本次改动范围）

## Boundaries

- **范围**：`src/popup/Popup.vue`、`src/sidepanel/Sidepanel.vue`、`src/sidepanel/components/`（SidepanelHeader / PageSection / TagFolder / MarkItem / StorageManager）、`src/styles/main.css`、`unocss.config.ts`，共 9 个文件。
- **不动内容脚本注入 UI**：`Tooltip.vue` / `DisambiguationModal.vue` 保留 rounded-lg + shadow-xl——浮层在任意第三方页面背景上需要阴影与实底保证可读性，属功能性差异（Driver 已确认）。
- **不动语义色**：Popup 的 orange 警告条（刷新提示）属警示语义，非品牌/质感色，保留。
- **不动结构**：卡片布局、间距、交互逻辑、transition 反馈均保留；仅改质感 token。
- **死资产记录不删除**：`src/assets/logo.svg`（旧 Google 蓝 #4285f4）与 `src/components/Logo.vue` 全仓零引用（仅 Logo.test.ts 自引用），本次仅记录，删除另立任务。
- **验证**：`pnpm lint` / `pnpm test` / `pnpm build` exit 0；视觉对照截图人工确认（Layer 3）。
