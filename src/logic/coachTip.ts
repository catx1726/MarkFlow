/**
 * Coach Tip（首次引导浮层）纯逻辑
 * Spec: docs/superpowers/specs/2026-09-11-coach-tip-design.md
 *
 * 触发条件：用户划了词（非折叠选区）但未按住 Alt，且从未被引导过。
 * 「已引导」= 显示过一次 Coach Tip（显示即置位）
 *          或已成功用 Alt 创建过标记（学会即标记，见 UIManager.createHighlight）。
 */

export interface CoachTipCondition {
  altKey: boolean
  isCollapsed: boolean
  onMarkElement: boolean
  coachTipDone: boolean
}

export function shouldShowCoachTip(condition: CoachTipCondition): boolean {
  const { altKey, isCollapsed, onMarkElement, coachTipDone } = condition
  return !altKey && !isCollapsed && !onMarkElement && !coachTipDone
}

/** 键帽文案：Mac 上 Alt 键实际是 Option（⌥），按平台习惯展示 */
export function coachKeyLabel(isMac: boolean): string {
  return isMac ? '⌥ Option' : 'Alt'
}
