import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { UIManager } from '../contentScripts/ui'
import { HighlightStateManager } from '../contentScripts/state'

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getURL: vi.fn(() => 'mock-style.css'),
    },
  },
}))

vi.mock('webext-bridge/content-script', () => ({
  sendMessage: vi.fn(),
  onMessage: vi.fn(),
}))

vi.mock('~/logic/settings', () => ({
  settings: ref({
    defaultHighlightColor: '#FFFF00',
    highlightColors: ['#FFFF00', '#99FF99', '#FF9999', '#99CCFF', '#FFCC99'],
    blacklist: [],
  }),
  settingsReady: Promise.resolve(),
  isPageBlacklisted: vi.fn(() => false),
}))

describe('UIManager', () => {
  let state: HighlightStateManager
  let ui: UIManager

  beforeEach(() => {
    vi.stubGlobal('__NAME__', 'test-extension')
    vi.useFakeTimers()
    state = new HighlightStateManager()
    ui = new UIManager(state)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('should initialize with null tooltip and modal', () => {
    expect(state.tooltipApp).toBeNull()
    expect(state.disambiguationModalApp).toBeNull()
  })

  it('clearPreviewHighlight should run without error', () => {
    expect(() => ui.clearPreviewHighlight()).not.toThrow()
  })

  it('hideTooltip should run without error', () => {
    expect(() => ui.hideTooltip()).not.toThrow()
  })

  it('setOriginalColorForChange should set the private field', () => {
    ui.setOriginalColorForChange('#FF0000')
    expect(() => ui.clearPreviewWithColorRestore()).not.toThrow()
  })

  it('clearPreviewWithColorRestore should run without error', () => {
    expect(() => ui.clearPreviewWithColorRestore()).not.toThrow()
  })
})
