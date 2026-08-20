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

export const TOOLTIP_MARGIN = 8

export function clamp(value: number, min: number, max: number): number {
  // 当 max < min 时（如 tooltip 高于视口），退化为返回 min
  if (max < min)
    return min
  return Math.min(Math.max(value, min), max)
}

/**
 * 从 rangy Range 获取选区的 bounding rect。
 *
 * 注意：@types/rangy 声明 `RangyRange extends Range`（原生 DOM Range），
 * 但 rangy 1.3 的 WrappedRange **运行时并未实现** `getBoundingClientRect()`，
 * 直接调用会抛 TypeError。必须通过其包装的 `nativeRange` 获取。
 *
 * 返回 `null` 表示无法获取，由调用方决定降级策略（如回退鼠标坐标）。
 */
export function getRangyRangeRect(range: unknown): DOMRect | null {
  const r = range as { nativeRange?: Range } & Partial<Range>
  // rangy WrappedRange：经其包装的原生 Range 获取
  if (r.nativeRange)
    return r.nativeRange.getBoundingClientRect()
  // 原生 Range 或其他实现了 getBoundingClientRect 的对象
  if (typeof r.getBoundingClientRect === 'function')
    return r.getBoundingClientRect()
  // 罕见环境：无法获取，打日志并返回 null 交给调用方降级
  console.warn('[MarkFlow] getRangyRangeRect: 无法获取选区 rect，返回 null', range)
  return null
}

export function computeTooltipPosition(
  anchor: AnchorRect,
  tooltip: Size,
  viewport: Size,
  margin = TOOLTIP_MARGIN,
  gap = 8,
): { x: number, y: number } {
  const anchorBottom = anchor.top + anchor.height

  const spaceBelow = viewport.height - margin - (anchorBottom + gap)
  const spaceAbove = anchor.top - gap - margin

  let y: number
  if (tooltip.height > viewport.height - 2 * margin) {
    // 规则 0：tooltip 比视口可用高度还高，贴顶显示（内容自身可滚动）
    y = margin
  }
  else if (spaceBelow >= tooltip.height) {
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
