import { beforeAll, describe, expect, it } from 'vitest'
import { shouldMenuOpenUp } from '~/sidepanel/composables/menuPosition'

beforeAll(() => {
  // 显式固定视口高度，防 jsdom 默认值漂移导致测试脆弱
  Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
})

function mockEvent(bottomGap: number): MouseEvent {
  // window.innerHeight 在 jsdom 默认 768；通过 gap 反推 bottom
  const rect = { bottom: window.innerHeight - bottomGap }
  return { currentTarget: { getBoundingClientRect: () => rect } } as unknown as MouseEvent
}

describe('menuPosition', () => {
  it('下方空间充足时向下弹出', () => {
    expect(shouldMenuOpenUp(mockEvent(400), 260)).toBe(false)
  })

  it('下方空间不足时向上弹出', () => {
    expect(shouldMenuOpenUp(mockEvent(100), 260)).toBe(true)
  })

  it('边界值：恰好等于预估高度时向下', () => {
    expect(shouldMenuOpenUp(mockEvent(260), 260)).toBe(false)
  })
})
