import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-classapplier'
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
    highlightHeight: 5,
  }),
  settingsReady: Promise.resolve(),
  isPageBlacklisted: vi.fn(() => false),
}))

describe('highlightRestorer', () => {
  let state: HighlightStateManager
  let restorer: HighlightRestorer

  beforeAll(() => {
    rangy.init()
  })

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
    await expect(restorer.restoreHighlights()).resolves.toEqual([])
  })

  it('refreshHighlights should run without error when no highlights exist', async () => {
    await expect(restorer.refreshHighlights()).resolves.toBeUndefined()
  })

  it('scrollToMark should handle non-existent mark gracefully', async () => {
    const { sendMessage } = await import('webext-bridge/content-script')
    vi.mocked(sendMessage).mockResolvedValue(null)
    await expect(restorer.scrollToMark('nonexistent')).resolves.toBeUndefined()
  })

  it('should mark restore as failed when path and search both fail', async () => {
    const { sendMessage } = await import('webext-bridge/content-script')
    const mark = {
      id: 'missing-id',
      url: 'https://example.com/page',
      text: 'text that does not exist in the dom',
      note: '',
      color: '#FFFF00',
      rangySerialized: 'invalid-serialized-range',
      createdAt: Date.now(),
    }

    vi.mocked(sendMessage).mockImplementation(async (messageType: string) => {
      if (messageType === 'get-marks-for-url')
        return [mark]
      if (messageType === 'update-mark-details')
        return { success: true }
      return undefined
    })

    await restorer.restoreHighlights()

    const updateCalls = vi.mocked(sendMessage).mock.calls.filter(([type]) => type === 'update-mark-details')
    expect(updateCalls.length).toBeGreaterThan(0)
    expect(updateCalls[0][1]).toMatchObject({
      id: 'missing-id',
      url: 'https://example.com/page',
      restoreFailedAt: expect.any(Number),
    })
  })
})
