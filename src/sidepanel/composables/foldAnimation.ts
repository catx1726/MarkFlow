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
  /** 钉扎收尾观察期（ms）：动画定时器结束后继续盯几帧，吸收 v-if 移除当帧的残余位移 */
  pinGraceMs: 120,
} as const

/** 是否为大列表（超过阈值则使用更长的动画时长） */
export function isLargeList(markCount: number): boolean {
  return markCount > FOLD.largeListThreshold
}

/**
 * # 折叠动画期间的吸顶钉扎（Scroll Pinning）
 *
 * 高度折叠动画期间，被点击的吸顶头（面板的前一个兄弟元素）会被其
 * sticky 容器底边拖着移动——容器随内容收缩而塌缩（深吸顶，或「网页内
 * 其余组默认收起」使组列表只剩头时最明显，实测位移 140px+），表现为
 * 收起向上/展开向下的抖动。
 *
 * 每帧测量锚点（面板前一个兄弟元素）的视口位置并反向 scrollBy 抵消：
 * 反馈式闭环，天然兼容滚动钳制（被钳制的部分已体现在测量值中，不会
 * 过补偿）。用户主动滚动（wheel/touchmove）时立即放弃钉扎，避免与
 * 输入对抗。返回 stop 函数，动画结束（含 pinGraceMs 观察期）后调用。
 *
 * @param panel 正在折叠/展开的面板元素，取其 previousElementSibling 为锚点
 */
export function pinAnchorDuringFold(panel: HTMLElement): () => void {
  const anchor = panel.previousElementSibling
  if (!(anchor instanceof HTMLElement))
    return () => {}

  const startTop = anchor.getBoundingClientRect().top
  let raf = 0
  let stopped = false

  const stop = () => {
    stopped = true
    cancelAnimationFrame(raf)
    window.removeEventListener('wheel', stop)
    window.removeEventListener('touchmove', stop)
  }

  window.addEventListener('wheel', stop, { passive: true })
  window.addEventListener('touchmove', stop, { passive: true })

  const tick = () => {
    if (stopped)
      return
    const delta = anchor.getBoundingClientRect().top - startTop
    if (Math.abs(delta) > 0.5)
      window.scrollBy(0, delta)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return stop
}
