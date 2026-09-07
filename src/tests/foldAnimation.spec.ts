import { describe, expect, it } from 'vitest'
import { FOLD, isLargeList } from '../sidepanel/composables/foldAnimation'

/**
 * Issue #80：折叠动画的集中常量与大列表判定。
 * 大列表使用更长（而非更短）的动画时长——measured-px 高度动画
 * 对子树零成本，距离更长需要更多时间保证丝滑。
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
    })

    it('should give large lists a longer duration for smoothness', () => {
      expect(FOLD.largeListDuration).toBeGreaterThan(FOLD.heightDuration)
    })
  })
})
