/**
 * 下拉菜单翻向工具：下方空间不足时向上弹出，
 * 避免页面底部元素的菜单被视口底边/固定底栏截断。
 */

/** 各菜单的预估高度（px），用于翻向判定；调整菜单项数量时同步更新 */
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

/** 生成条件 class：向上弹出用 bottom-full，向下用 mt- */
export function menuPlacementClass(opensUp: boolean, marginClass = 'mt-2'): string {
  return opensUp ? 'bottom-full mb-2' : marginClass
}
