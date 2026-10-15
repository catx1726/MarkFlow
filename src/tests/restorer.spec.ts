import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

  describe('title backfill (legacy marks self-healing)', () => {
    const legacyMark = {
      id: 'legacy-1',
      url: 'https://example.com/page',
      text: 'text that does not exist in the dom',
      note: '',
      color: '#FFFF00',
      rangySerialized: 'invalid-serialized-range',
      createdAt: Date.now(),
    }

    beforeEach(async () => {
      const { sendMessage } = await import('webext-bridge/content-script')
      vi.mocked(sendMessage).mockClear()
    })

    afterEach(() => {
      document.title = ''
    })

    it('缺 title 的标记应在恢复时回填当前网页标题', async () => {
      const { sendMessage } = await import('webext-bridge/content-script')
      document.title = 'Example Page Title'
      vi.mocked(sendMessage).mockImplementation(async (messageType: string) => {
        if (messageType === 'get-marks-for-url')
          return [{ ...legacyMark }]
        if (messageType === 'update-mark-details')
          return { success: true }
        return undefined
      })

      await restorer.restoreHighlights()

      const titleCalls = vi.mocked(sendMessage).mock.calls
        .filter(([type, payload]: any[]) => type === 'update-mark-details' && payload?.title)
      expect(titleCalls.length).toBe(1)
      expect(titleCalls[0][1]).toMatchObject({
        id: 'legacy-1',
        url: expect.any(String), // 当前页 canonical URL(jsdom 环境为 localhost)
        title: 'Example Page Title',
      })
    })

    it('已有 title 的标记不回填', async () => {
      const { sendMessage } = await import('webext-bridge/content-script')
      document.title = 'Example Page Title'
      vi.mocked(sendMessage).mockImplementation(async (messageType: string) => {
        if (messageType === 'get-marks-for-url')
          return [{ ...legacyMark, id: 'has-title-1', title: 'Original Title' }]
        if (messageType === 'update-mark-details')
          return { success: true }
        return undefined
      })

      await restorer.restoreHighlights()

      const titleCalls = vi.mocked(sendMessage).mock.calls
        .filter(([type, payload]: any[]) => type === 'update-mark-details' && payload?.title)
      expect(titleCalls.length).toBe(0)
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

  describe('unified failure cooldown (issue #91)', () => {
    afterEach(() => {
      document.body.innerHTML = ''
      vi.restoreAllMocks()
    })

    function searchLogCount(spy: ReturnType<typeof vi.spyOn>): number {
      return spy.mock.calls.filter(args => String(args[0]).includes('Searching ID')).length
    }

    it('multiple 歧义标记失败后进入冷却，冷却期内不重复触发搜索', async () => {
      const { sendMessage } = await import('webext-bridge/content-script')
      document.body.innerHTML = `
        <div><p>duplicated target text</p></div>
        <div><p>duplicated target text</p></div>`
      const mark = {
        id: 'ambiguous-1',
        url: 'https://example.com/page',
        text: 'duplicated target text',
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
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await restorer.restoreHighlights()
      // 核心断言：歧义（multiple）失败同样进入冷却（原实现裸 return false 无冷却）
      expect(state.isOnCooldown('ambiguous-1')).toBe(true)

      const afterFirst = searchLogCount(logSpy)
      expect(afterFirst).toBeGreaterThan(0)

      // 冷却期内（3s）再次触发：不应重复搜索
      await restorer.restoreHighlights()
      expect(searchLogCount(logSpy)).toBe(afterFirst)
    })

    it('存在失败标记的页面在冷却后进入完成态，5s 早退对失败页生效', async () => {
      const { sendMessage } = await import('webext-bridge/content-script')
      document.body.innerHTML = '<div><p>totally absent text</p></div>'
      const mark = {
        id: 'missing-1',
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
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await restorer.restoreHighlights() // 失败 → 进冷却
      expect(state.isOnCooldown('missing-1')).toBe(true)
      const afterFirst = searchLogCount(logSpy)

      await restorer.restoreHighlights() // 冷却内：marksToRestore 空 → 进入完成态
      expect(searchLogCount(logSpy)).toBe(afterFirst)

      await restorer.restoreHighlights() // 完成态窗内：早退，无消息往返
      expect(searchLogCount(logSpy)).toBe(afterFirst)
      const pings = vi.mocked(sendMessage).mock.calls.filter(([type]) => type === 'get-marks-for-url').length
      await restorer.restoreHighlights()
      expect(vi.mocked(sendMessage).mock.calls.filter(([type]) => type === 'get-marks-for-url').length).toBe(pings)
    })

    it('增量 pass 中 shadow 标记跳过兜底：不搜索、不刷新冷却、不上报 restoreFailedAt（CR Blocking #2）', async () => {
      const { sendMessage } = await import('webext-bridge/content-script')
      document.body.innerHTML = '<div><p>plain text</p></div>'
      const mark = {
        id: 'shadow-1',
        url: 'https://example.com/page',
        text: 'text that does not exist in the dom',
        note: '',
        color: '#FFFF00',
        rangySerialized: 'invalid-serialized-range',
        shadowHostSelector: '#shadow-host',
        createdAt: Date.now(),
      }
      vi.mocked(sendMessage).mockImplementation(async (messageType: string) => {
        if (messageType === 'get-marks-for-url')
          return [mark]
        if (messageType === 'update-mark-details')
          return { success: true }
        return undefined
      })
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Pass #1 全量：host 缺失 → 失败上报 + 3s 冷却（此时未进入完成态）
      await restorer.restoreHighlights()
      const failedAfterFull = vi.mocked(sendMessage).mock.calls
        .filter(([type, payload]: any[]) => type === 'update-mark-details' && payload?.restoreFailedAt).length
      expect(failedAfterFull).toBe(1)

      // Pass #2 全量（冷却内）：marksToRestore 空 → 进入完成态
      await restorer.restoreHighlights()

      // 推进 3.5s：冷却(3s)已过、重验窗(5s)内——增量 pass 的目标区间
      vi.useFakeTimers()
      vi.setSystemTime(Date.now() + 3500)
      const cooldownBefore = state.failedRestoreCooldowns.get('shadow-1')
      const scope = document.createElement('section')
      await restorer.restoreHighlights([scope]) // Pass #3 增量
      vi.useRealTimers()

      // 增量绕过完成态早退（本 pass 重新 ping）
      expect(vi.mocked(sendMessage).mock.calls.filter(([type]) => type === 'get-marks-for-url').length).toBe(3)
      // 不搜索（未尝试 ≠ 失败）
      expect(searchLogCount(logSpy)).toBe(0)
      // 不刷新冷却（值与增量前一致，全量重验兜底）
      expect(state.failedRestoreCooldowns.get('shadow-1')).toBe(cooldownBefore)
      // 不重复上报 restoreFailedAt
      const failedAfterIncremental = vi.mocked(sendMessage).mock.calls
        .filter(([type, payload]: any[]) => type === 'update-mark-details' && payload?.restoreFailedAt).length
      expect(failedAfterIncremental).toBe(failedAfterFull)
    })
  })
})
