import { describe, expect, it } from 'vitest'
import { clamp, computeTooltipPosition, getRangyRangeRect } from '~/logic/tooltipPosition'

const VIEWPORT = { width: 1280, height: 800 }
const TOOLTIP = { width: 320, height: 340 }
const MARGIN = 8
const GAP = 8

describe('computeTooltipPosition', () => {
  it('选区下方空间充足时，放在选区下方并左对齐选区', () => {
    const anchor = { top: 100, left: 200, width: 300, height: 24 }
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT)
    expect(pos.y).toBe(anchor.top + anchor.height + GAP) // 132
    expect(pos.x).toBe(anchor.left)
  })

  it('下方空间不足、上方充足时，翻转到选区上方', () => {
    // 下方剩余: 800 - (700+24) = 76 < 340+8；上方: 700 充足
    const anchor = { top: 700, left: 200, width: 300, height: 24 }
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT)
    expect(pos.y).toBe(anchor.top - GAP - TOOLTIP.height) // 352
    expect(pos.x).toBe(anchor.left)
  })

  it('上下均不足时，选择剩余空间较大的一侧并钳制在视口内', () => {
    // 选区几乎占满视口：下方 60px，上方 100px → 选上方，但高度 340 放不下 → 钳制到 margin
    const anchor = { top: 100, left: 200, width: 800, height: 640 }
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT)
    // 上方空间(100) > 下方空间(60)，选上方；理想 y = 100-8-340 = -248 → 钳制到 8
    expect(pos.y).toBe(MARGIN)
    expect(pos.x).toBe(anchor.left)
  })

  it('选区靠近视口右缘时，水平方向钳制不溢出', () => {
    const anchor = { top: 100, left: 1200, width: 60, height: 24 }
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT)
    expect(pos.x).toBe(VIEWPORT.width - TOOLTIP.width - MARGIN) // 952
  })

  it('选区贴近视口左缘时，水平方向钳制到 margin', () => {
    const anchor = { top: 100, left: 2, width: 100, height: 24 }
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT)
    expect(pos.x).toBe(MARGIN)
  })

  it('选区紧贴视口顶底（超高选区）时，结果始终在视口内', () => {
    const anchor = { top: 0, left: 0, width: 1280, height: 800 }
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT)
    expect(pos.y).toBeGreaterThanOrEqual(MARGIN)
    expect(pos.y + TOOLTIP.height).toBeLessThanOrEqual(VIEWPORT.height - MARGIN)
    expect(pos.x).toBeGreaterThanOrEqual(MARGIN)
    expect(pos.x + TOOLTIP.width).toBeLessThanOrEqual(VIEWPORT.width - MARGIN)
  })

  it('下方恰好容纳时仍放下方（边界值）', () => {
    // 需要: bottom + gap + height ≤ viewport.height - margin
    // bottom + 8 + 340 ≤ 792 → bottom ≤ 444 → top = 420
    const anchor = { top: 420, left: 200, width: 300, height: 24 }
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT)
    expect(pos.y).toBe(444 + GAP)
  })

  it('tooltip 高于视口时，贴顶显示（规则 0 显式分支）', () => {
    const tall = { width: 320, height: 900 }
    const anchor = { top: 100, left: 200, width: 300, height: 24 }
    const pos = computeTooltipPosition(anchor, tall, VIEWPORT)
    expect(pos.y).toBe(MARGIN)
  })

  it('支持自定义 margin/gap 参数', () => {
    const anchor = { top: 100, left: 200, width: 300, height: 24 }
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT, 20, 16)
    expect(pos.y).toBe(anchor.top + anchor.height + 16)
    // 下方: 800-20-(124+16) = 640 >= 340 ✓；水平左对齐锚点
    expect(pos.x).toBe(anchor.left)
  })
})

describe('clamp', () => {
  it('常规范围钳制', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })

  it('max < min 时退化为返回 min（tooltip 高于视口场景）', () => {
    expect(clamp(100, 8, -20)).toBe(8)
  })
})

describe('getRangyRangeRect（rangy WrappedRange 兼容）', () => {
  it('通过 nativeRange 获取 bounding rect（rangy WrappedRange 运行时无 getBoundingClientRect）', () => {
    const mockRect = new DOMRect(10, 20, 100, 24)
    // 模拟 rangy WrappedRange：无 getBoundingClientRect 方法，仅有 nativeRange
    const rangyRange = {
      nativeRange: {
        getBoundingClientRect: () => mockRect,
      },
    }
    expect(getRangyRangeRect(rangyRange)).toBe(mockRect)
  })

  it('兼容原生 Range（自身实现 getBoundingClientRect 的对象）', () => {
    const mockRect = new DOMRect(50, 60, 200, 30)
    const nativeRange = { getBoundingClientRect: () => mockRect }
    expect(getRangyRangeRect(nativeRange)).toBe(mockRect)
  })

  it('无法获取 rect 时返回 null，由调用方降级', () => {
    expect(getRangyRangeRect({})).toBeNull()
  })
})
