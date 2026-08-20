/**
 * Tooltip 智能定位纯函数（选区感知）
 * Spec: docs/superpowers/specs/2026-08-20-tooltip-positioning-drag-design.md
 *
 * 规则（按优先级）：
 * 1. 选区下方可容纳 → 放下方
 * 2. 上方可容纳 → 翻转到上方
 * 3. 上下均不足 → 选剩余空间较大的一侧，最终钳制进视口
 * 水平方向始终左对齐选区起点并做视口钳制。
 * 所有坐标均为 viewport 坐标（getBoundingClientRect / fixed 定位）。
 */

export interface AnchorRect {
  top: number
  left: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * 从 rangy Range 获取选区的 bounding rect。
 *
 * 注意：@types/rangy 声明 `RangyRange extends Range`（原生 DOM Range），
 * 但 rangy 1.3 的 WrappedRange **运行时并未实现** `getBoundingClientRect()`，
 * 直接调用会抛 TypeError。必须通过其包装的 `nativeRange` 获取。
 */
export function getRangyRangeRect(range: unknown): DOMRect {
  const nativeRange = (range as { nativeRange?: Range }).nativeRange
  if (nativeRange)
    return nativeRange.getBoundingClientRect()
  // 竟底：无原生 Range 的罕见环境，退回视口上部中央（打日志便于追踪异常路径）
  console.warn('[MarkFlow] getRangyRangeRect: 未找到 nativeRange，使用 fallback 定位', range)
  return new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 0, 0)
}

export function computeTooltipPosition(
  anchor: AnchorRect,
  tooltip: Size,
  viewport: Size,
  margin = 8,
  gap = 8,
): { x: number, y: number } {
  const anchorBottom = anchor.top + anchor.height

  const spaceBelow = viewport.height - margin - (anchorBottom + gap)
  const spaceAbove = anchor.top - gap - margin

  let y: number
  if (spaceBelow >= tooltip.height) {
    // 规则 1：下方可容纳
    y = anchorBottom + gap
  }
  else if (spaceAbove >= tooltip.height) {
    // 规则 2：翻转到上方
    y = anchor.top - gap - tooltip.height
  }
  else {
    // 规则 3：选剩余空间较大的一侧，尽量贴近选区
    y = spaceAbove >= spaceBelow
      ? anchor.top - gap - tooltip.height
      : anchorBottom + gap
  }

  // 视口钳制（tooltip 高于视口时 max < min，clamp 退化为 min = margin）
  y = clamp(y, margin, viewport.height - margin - tooltip.height)

  // 水平：左对齐选区起点，钳制进视口
  const x = clamp(anchor.left, margin, viewport.width - margin - tooltip.width)

  return { x, y }
}
