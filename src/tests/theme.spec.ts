import { describe, expect, it } from 'vitest'
import { resolveTheme } from '~/logic/theme'

describe('resolveTheme', () => {
  it('auto 跟随系统', () => {
    expect(resolveTheme('auto', true)).toBe(true)
    expect(resolveTheme('auto', false)).toBe(false)
  })

  it('手动覆盖系统设置', () => {
    expect(resolveTheme('dark', false)).toBe(true)
    expect(resolveTheme('light', true)).toBe(false)
  })
})
