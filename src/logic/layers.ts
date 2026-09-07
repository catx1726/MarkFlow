/**
 * # 侧边栏 z-index 分层 token (Sidepanel Layering Tokens)
 *
 * 集中定义侧边栏的层级体系，消除散落在各组件中的魔法数字。
 *
 * **作用域**：仅适用于 sidepanel 文档。content-script 运行在页面
 * Shadow DOM 内，层级由 `getMaxZIndex()`（`logic/dom.ts`）动态管理，
 * 请勿在 content-script 中引用本文件。
 *
 * ## 分层表
 *
 * | token | 值 | 用途 |
 * |------|-----|------|
 * | `stickyChapter` | 10 | 章节组吸顶头 |
 * | `stickyPage` | 20 | 网页级吸顶头 |
 * | `stickyFolder` | 30 | 标签文件夹吸顶行 |
 * | `stickyHeader` | 40 | 侧边栏主 header（搜索/新建标签） |
 * | `fixedBar` | 50 | 底部存储栏（须高于全部吸顶层） |
 * | `menuElevated` | 60 | ⋯ 菜单打开时其所在吸顶层的临时提升值 |
 * | `modal` | 70 | 模态对话框 |
 *
 * ## 菜单遮挡的修复原理（Issue #79）
 *
 * ⋯ 菜单是 sticky 吸顶元素的子节点，自身 z 值被封死在父级堆叠
 * 上下文中（z-20 的菜单装在 z-10 的吸顶头里，根上下文眼中它只是
 * z-10）。因此菜单打开时把所在吸顶层临时提升到 `menuElevated`，
 * 菜单随父级脱离遮挡。菜单同一时刻只开一个（`closeMenus`），
 * 无并发冲突。
 *
 * @module layers
 */
export const Z_LAYERS = {
  stickyChapter: 10,
  stickyPage: 20,
  stickyFolder: 30,
  stickyHeader: 40,
  fixedBar: 50,
  menuElevated: 60,
  modal: 70,
} as const
