/**
 * # 展开动画集中常量 (Fold Animation Constants)
 *
 * Issue #80：折叠动画由 FoldPanel / TagFolder 以「JS 测量容器 px 高度」
 * 实现（子树只布局一次，每帧仅容器自身重排），grid 0fr↔1fr 方案已弃用。
 *
 * 大列表不再缩短动画时长——measured-px 高度动画对子树零成本，容器越高
 * 距离越长，反而需要稍长的时长才显得丝滑（100ms 扫过 2000px 视觉上
 * 等于瞬切）。
 *
 * 所有阈值/时长集中在此，组件内禁止散落魔法数字。
 *
 * @module foldAnimation
 */
export const FOLD = {
  /** 超过该 mark 数视为大列表 */
  largeListThreshold: 20,
  /** 单条 MarkItem 预估高度（px），仅用于阈值口径注释，不参与运行时计算 */
  estimatedMarkHeight: 32,
  /** 常规列表折叠动画时长（ms），PageSection 与 TagFolder 保持同步 */
  heightDuration: 150,
  /** 大列表折叠动画时长（ms）：距离更长，给更长时间保证丝滑 */
  largeListDuration: 200,
  /** 默认折叠阈值：超过该 mark 数的分组初始为收起状态 */
  defaultCollapseMarkThreshold: 15,
} as const

/** 是否为大列表（超过阈值则使用更长的动画时长） */
export function isLargeList(markCount: number): boolean {
  return markCount > FOLD.largeListThreshold
}
