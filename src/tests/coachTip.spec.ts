import { describe, expect, it } from 'vitest'
import { coachKeyLabel, isMacPlatform, isReshowDisabled, shouldShowCoachTip } from '~/logic/coachTip'

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

describe('isMacPlatform', () => {
  it('mac 平台字符串判定为 true', () => {
    expect(isMacPlatform('MacIntel')).toBe(true)
  })

  it('windows/linux 判定为 false', () => {
    expect(isMacPlatform('Win32')).toBe(false)
    expect(isMacPlatform('Linux x86_64')).toBe(false)
  })
})

describe('isReshowDisabled', () => {
  it('两个引导都从未显示 → 无物可重显，禁用', () => {
    expect(isReshowDisabled(false, false)).toBe(true)
  })

  it('任一已显示 → 可点击重显', () => {
    expect(isReshowDisabled(true, false)).toBe(false)
    expect(isReshowDisabled(false, true)).toBe(false)
  })

  it('两个都已显示（最常见重显场景）→ 必须可点击', () => {
    expect(isReshowDisabled(true, true)).toBe(false)
  })
})
