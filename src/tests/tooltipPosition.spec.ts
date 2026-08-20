import { describe, expect, it } from 'vitest'
import { clamp, clampToViewport, computeTooltipPosition, getRangyRangeRect } from '~/logic/tooltipPosition'

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
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT, { margin: 20, gap: 16 })
    expect(pos.y).toBe(anchor.top + anchor.height + 16)
    // 下方: 800-20-(124+16) = 640 >= 340 ✓；水平左对齐锚点
    expect(pos.x).toBe(anchor.left)
  })

  it('点锚点（点击已有标记场景）：出现在点击点下方，视口底部则翻转上方', () => {
    // 点击页面中部 → 下方
    expect(computeTooltipPosition({ top: 400, left: 300, width: 0, height: 0 }, TOOLTIP, VIEWPORT))
      .toEqual({ x: 300, y: 400 + GAP })
    // 点击靠近底部 → 翻转到上方
    expect(computeTooltipPosition({ top: 780, left: 300, width: 0, height: 0 }, TOOLTIP, VIEWPORT))
      .toEqual({ x: 300, y: 780 - GAP - TOOLTIP.height })
  })

  it('鼠标感知：正向划选（指针在选区下半）放下方且水平跟随鼠标', () => {
    const anchor = { top: 100, left: 200, width: 300, height: 24 } // centerY = 112
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT, { pointer: { x: 460, y: 118 } })
    expect(pos.y).toBe(anchor.top + anchor.height + GAP) // 下方
    expect(pos.x).toBe(460) // 跟随鼠标而非 rect.left=200
  })

  it('鼠标感知：反向划选（指针在选区上半）放上方', () => {
    const anchor = { top: 500, left: 200, width: 300, height: 24 } // centerY = 512
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT, { pointer: { x: 300, y: 505 } })
    expect(pos.y).toBe(anchor.top - GAP - TOOLTIP.height) // 上方
    expect(pos.x).toBe(300)
  })

  it('鼠标感知：指针贴近右缘时水平钳制不溢出', () => {
    const anchor = { top: 100, left: 200, width: 300, height: 24 }
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT, { pointer: { x: 1270, y: 118 } })
    expect(pos.x).toBe(VIEWPORT.width - TOOLTIP.width - MARGIN)
  })

  it('鼠标感知：首选侧空间不足时自动翻转', () => {
    // 指针在下半（偏下方），但下方空间不足 → 翻转上方
    const anchor = { top: 700, left: 200, width: 300, height: 24 } // centerY=712
    const pos = computeTooltipPosition(anchor, TOOLTIP, VIEWPORT, { pointer: { x: 300, y: 720 } })
    expect(pos.y).toBe(anchor.top - GAP - TOOLTIP.height)
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

describe('clampToViewport（拖拽位置约束）', () => {
  const size = { width: 320, height: 340 }

  it('视口内坐标原样返回', () => {
    expect(clampToViewport(100, 100, size, VIEWPORT)).toEqual({ x: 100, y: 100 })
  })

  it('拖出右/下边缘时钳制到视口内', () => {
    expect(clampToViewport(2000, 2000, size, VIEWPORT)).toEqual({ x: 952, y: 452 })
  })

  it('拖出左/上边缘时钳制到 margin', () => {
    expect(clampToViewport(-50, -50, size, VIEWPORT)).toEqual({ x: 8, y: 8 })
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
