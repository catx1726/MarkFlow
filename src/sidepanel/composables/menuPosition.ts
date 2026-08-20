/**
 * 下拉菜单翻向工具：下方空间不足时向上弹出，
 * 避免页面底部元素的菜单被视口底边/固定底栏截断。
 */

/**
 * 各菜单的预估高度（px），用于翻向判定；调整菜单项数量时同步更新。
 * mark: 260 — 标记菜单（展开/备注/复制/标签/编辑/删除，最多约 6 项）
 * url: 180 — 网页菜单（导出/加标签/清空，3 项）
 * group: 200 — 章节组菜单（导出/加标签/清空，3 项 + 组标题行）
 * folder: 200 — 文件夹菜单（重命名/删除，2 项）
 */
export const MENU_HEIGHTS = {
  mark: 260,
  url: 180,
  group: 200,
  folder: 200,
} as const

/** 根据触发按钮位置判断菜单是否应向上弹出 */
export function shouldMenuOpenUp(e: MouseEvent, estimatedHeight: number): boolean {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  return window.innerHeight - rect.bottom < estimatedHeight
}
