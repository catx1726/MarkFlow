import { describe, expect, it, vi } from 'vitest'

import { highlightDefaultStyle } from '../logic/config'

vi.mock('webextension-polyfill', () => ({
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
}))

describe('config', () => {
  it('highlightDefaultStyle should return default height 5 style string', () => {
    expect(highlightDefaultStyle('#FFFF00')).toBe(
      'box-shadow: inset 0 -5px 0 0 #FFFF00; padding-bottom: 5px; cursor: pointer;',
    )
  })

  it('highlightDefaultStyle should return custom height 8 style string with matching padding-bottom', () => {
    expect(highlightDefaultStyle('#FF0000', 8)).toBe(
      'box-shadow: inset 0 -8px 0 0 #FF0000; padding-bottom: 8px; cursor: pointer;',
    )
  })
})
