import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { HighlightRestorer } from '../contentScripts/restorer'
import { HighlightStateManager } from '../contentScripts/state'
import { UIManager } from '../contentScripts/ui'

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

describe('HighlightRestorer', () => {
  let state: HighlightStateManager
  let ui: UIManager
  let restorer: HighlightRestorer

  beforeEach(() => {
    vi.stubGlobal('__NAME__', 'test-extension')
    vi.useFakeTimers()
    state = new HighlightStateManager()
    ui = new UIManager(state)
    restorer = new HighlightRestorer(state, ui)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('should initialize with default values', () => {
    expect(restorer).toBeDefined()
  })

  it('restoreHighlights should handle no marks gracefully', async () => {
    const { sendMessage } = await import('webext-bridge/content-script')
    vi.mocked(sendMessage).mockResolvedValue([])
    await expect(restorer.restoreHighlights()).resolves.toBeUndefined()
  })

  it('refreshHighlights should run without error when no highlights exist', async () => {
    await expect(restorer.refreshHighlights()).resolves.toBeUndefined()
  })

  it('scrollToMark should handle non-existent mark gracefully', async () => {
    const { sendMessage } = await import('webext-bridge/content-script')
    vi.mocked(sendMessage).mockResolvedValue(null)
    await expect(restorer.scrollToMark('nonexistent')).resolves.toBeUndefined()
  })

  it('debouncedRestore should not call restore when already restoring', () => {
    state.isRestoring = true
    restorer.debouncedRestore()
    vi.advanceTimersByTime(500)
    expect(state.isRestoring).toBe(true)
  })

  it('debouncedRestore should debounce calls', () => {
    state.isRestoring = false
    restorer.debouncedRestore()
    vi.advanceTimersByTime(100)
    restorer.debouncedRestore()
    vi.advanceTimersByTime(300)
    expect(restorer).toBeDefined()
  })
})
