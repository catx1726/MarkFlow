import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { HighlightRestorer } from '../contentScripts/restorer'
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

describe('HighlightRestorer', () => {
  let state: HighlightStateManager
  let restorer: HighlightRestorer

  beforeEach(() => {
    state = new HighlightStateManager()
    restorer = new HighlightRestorer(state)
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
})
