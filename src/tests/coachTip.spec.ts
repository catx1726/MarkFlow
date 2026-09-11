import { describe, expect, it } from 'vitest'
import { coachKeyLabel, shouldShowCoachTip } from '~/logic/coachTip'

describe('shouldShowCoachTip', () => {
  const base = { altKey: false, isCollapsed: false, onMarkElement: false, coachTipDone: false }

  it('普通划词（未按 Alt、非折叠、未置位）→ 显示', () => {
    expect(shouldShowCoachTip(base)).toBe(true)
  })

  it('已置位 → 不显示（严格一次）', () => {
    expect(shouldShowCoachTip({ ...base, coachTipDone: true })).toBe(false)
  })

  it('按住 Alt 的划词 → 不显示（已是核心手势路径，Tooltip 接管）', () => {
    expect(shouldShowCoachTip({ ...base, altKey: true })).toBe(false)
  })

  it('折叠选区（纯点击未划词）→ 不显示', () => {
    expect(shouldShowCoachTip({ ...base, isCollapsed: true })).toBe(false)
  })

  it('点击已有标记 → 不显示（走既有 Tooltip 路径）', () => {
    expect(shouldShowCoachTip({ ...base, onMarkElement: true })).toBe(false)
  })
})

describe('coachKeyLabel', () => {
  it('非 Mac 平台显示 Alt', () => {
    expect(coachKeyLabel(false)).toBe('Alt')
  })

  it('mac 平台显示 ⌥ Option', () => {
    expect(coachKeyLabel(true)).toBe('⌥ Option')
  })
})
