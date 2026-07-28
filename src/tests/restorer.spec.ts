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

  describe('restoration-complete early-exit (monitor throttling)', () => {
    async function pingCount() {
      const { sendMessage } = await import('webext-bridge/content-script')
      return vi.mocked(sendMessage).mock.calls.filter(([type]) => type === 'get-marks-for-url').length
    }

    it('恢复完成后，重验窗内的后续调用应跳过 sendMessage 往返', async () => {
      const { sendMessage } = await import('webext-bridge/content-script')
      vi.mocked(sendMessage).mockResolvedValue([])

      await restorer.restoreHighlights() // 首次：ping，0 marks，标记完成
      const afterFirst = await pingCount()

      await restorer.restoreHighlights() // 窗内：应早退，不再 ping
      expect(await pingCount()).toBe(afterFirst)
    })

    it('超过重验窗后，应重新 ping 以校验虚拟列表回收等场景', async () => {
      const { sendMessage } = await import('webext-bridge/content-script')
      vi.mocked(sendMessage).mockResolvedValue([])

      await restorer.restoreHighlights() // 标记完成
      const afterFirst = await pingCount()

      await restorer.restoreHighlights() // 窗内：早退
      expect(await pingCount()).toBe(afterFirst)

      vi.useFakeTimers()
      vi.setSystemTime(Date.now() + 10_000) // 超过 5s 重验窗
      await restorer.restoreHighlights() // 应重新 ping
      vi.useRealTimers()
      expect(await pingCount()).toBeGreaterThan(afterFirst)
    })

    it('refreshHighlights 应重置完成态，强制下次重新 ping', async () => {
      const { sendMessage } = await import('webext-bridge/content-script')
      vi.mocked(sendMessage).mockResolvedValue([])

      await restorer.restoreHighlights() // 标记完成
      const afterFirst = await pingCount()

      await restorer.restoreHighlights() // 窗内：早退
      expect(await pingCount()).toBe(afterFirst)

      await restorer.refreshHighlights() // 重置 + 内部 restoreHighlights 应重新 ping
      expect(await pingCount()).toBeGreaterThan(afterFirst)
    })
  })
})
