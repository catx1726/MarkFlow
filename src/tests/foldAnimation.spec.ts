import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FOLD, isLargeList, pinAnchorDuringFold } from '../sidepanel/composables/foldAnimation'

/**
 * Issue #80：折叠动画的集中常量与大列表判定。
 * 大列表使用更长（而非更短）的动画时长——measured-px 高度动画
 * 对子树零成本，距离更长需要更长时间保证丝滑。
 */
describe('foldAnimation', () => {
  describe('isLargeList', () => {
    it('should treat empty and small lists as not large', () => {
      expect(isLargeList(0)).toBe(false)
      expect(isLargeList(19)).toBe(false)
      expect(isLargeList(20)).toBe(false)
    })

    it('should treat lists above threshold as large', () => {
      expect(isLargeList(21)).toBe(true)
      expect(isLargeList(50)).toBe(true)
    })
  })

  describe('fold constants', () => {
    it('should centralize thresholds and durations', () => {
      expect(FOLD.largeListThreshold).toBe(20)
      expect(FOLD.estimatedMarkHeight).toBe(32)
      expect(FOLD.heightDuration).toBe(150)
      expect(FOLD.largeListDuration).toBe(200)
      expect(FOLD.defaultCollapseMarkThreshold).toBe(15)
      expect(FOLD.pinGraceMs).toBeGreaterThan(0)
    })

    it('should give large lists a longer duration for smoothness', () => {
      expect(FOLD.largeListDuration).toBeGreaterThan(FOLD.heightDuration)
    })
  })

  /**
   * 折叠动画期间吸顶头被 sticky 容器底边拖动（容器随内容塌缩），
   * pinAnchorDuringFold 每帧反向 scrollBy 抵消。此处测可测契约：
   * 补偿量、容差、用户滚动中断、无锚点兜底。
   */
  describe('pinAnchorDuringFold', () => {
    const rafQueue: FrameRequestCallback[] = []
    let scrollBy: ReturnType<typeof vi.spyOn>
    let anchor: HTMLElement
    let panel: HTMLElement
    let anchorTop = 100

    function flushFrame() {
      rafQueue.splice(0).forEach((cb) => {
        cb(0)
      })
    }

    beforeEach(() => {
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        rafQueue.push(cb)
        return rafQueue.length
      })
      vi.stubGlobal('cancelAnimationFrame', () => {})
      scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
      anchor = document.createElement('header')
      panel = document.createElement('div')
      document.body.append(anchor, panel)
      anchor.getBoundingClientRect = () => ({ top: anchorTop }) as DOMRect
    })

    afterEach(() => {
      vi.unstubAllGlobals()
      scrollBy.mockRestore()
      anchor.remove()
      panel.remove()
      rafQueue.length = 0
    })

    it('should scroll-compensate anchor drift each frame (feedback loop)', () => {
      const stop = pinAnchorDuringFold(panel)
      flushFrame() // 首帧无偏移：不补偿
      expect(scrollBy).not.toHaveBeenCalled()

      anchorTop = 60 // 锚点被容器底边拖上 40px → 反向滚动 -40 拉回
      flushFrame()
      expect(scrollBy).toHaveBeenCalledWith(0, -40)

      anchorTop = 100.2 // 容差内（≤0.5px）：不补偿
      flushFrame()
      expect(scrollBy).toHaveBeenCalledTimes(1)
      stop()
    })

    it('should stop pinning on user scroll intent (wheel)', () => {
      const stop = pinAnchorDuringFold(panel)
      window.dispatchEvent(new Event('wheel'))
      anchorTop = -50
      flushFrame()
      expect(scrollBy).not.toHaveBeenCalled()
      expect(() => stop()).not.toThrow()
    })

    it('should be a no-op when the panel has no previous sibling', () => {
      const stop = pinAnchorDuringFold(anchor)
      anchorTop = -999
      flushFrame()
      expect(scrollBy).not.toHaveBeenCalled()
      expect(() => stop()).not.toThrow()
    })
  })
})
