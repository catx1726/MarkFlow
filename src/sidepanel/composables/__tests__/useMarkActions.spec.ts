import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendMessage } from 'webext-bridge/options'
import browser from 'webextension-polyfill'
import { useMarkActions } from '../useMarkActions'

vi.mock('webext-bridge/options', () => ({
  sendMessage: vi.fn(),
}))

vi.mock('webextension-polyfill', () => {
  const browserMock = {
    tabs: {
      query: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    runtime: {
      lastError: null,
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  }
  return {
    default: browserMock,
    ...browserMock,
  }
})

describe('useMarkActions', () => {
  const { getNormalizedUrl, gotoMark, removeMark, saveNote, copyMarkText } = useMarkActions()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('getNormalizedUrl should normalize URLs', () => {
    expect(getNormalizedUrl('https://example.com/path/')).toBe('https://example.com/path')
    expect(getNormalizedUrl('https://example.com/')).toBe('https://example.com/')
  })

  it('gotoMark should update tab if it exists', async () => {
    const mark = { id: '1', url: 'https://example.com/path', text: 'test' } as any
    vi.mocked(browser.tabs.query).mockResolvedValue([{ id: 123, url: 'https://example.com/path/' }] as any)

    await gotoMark(mark)

    expect(browser.tabs.update).toHaveBeenCalledWith(123, { active: true })
    expect(sendMessage).toHaveBeenCalledWith('goto-mark', { markId: '1' }, expect.objectContaining({ tabId: 123 }))
  })

  it('gotoMark should create tab if it does not exist', async () => {
    const mark = { id: '1', url: 'https://example.com/path', text: 'test' } as any
    vi.mocked(browser.tabs.query).mockResolvedValue([])

    await gotoMark(mark)

    expect(browser.tabs.create).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('https://example.com/path') }))
  })

  it('removeMark should call background and notify content script', async () => {
    const mark = { id: '1', url: 'https://example.com/path', text: 'test' } as any
    vi.mocked(browser.tabs.query).mockResolvedValue([{ id: 123, url: 'https://example.com/path/' }] as any)
    vi.mocked(sendMessage).mockResolvedValue({ success: true } as any)

    await removeMark(mark)

    expect(sendMessage).toHaveBeenCalledWith('remove-mark', mark, 'background')
    expect(sendMessage).toHaveBeenCalledWith('remove-mark', mark, expect.objectContaining({ tabId: 123 }))
  })

  it('saveNote should call update-mark-details', async () => {
    await saveNote('1', 'url', 'note')
    expect(sendMessage).toHaveBeenCalledWith('update-mark-details', { id: '1', url: 'url', note: 'note' }, 'background')
  })

  it('copyMarkText should copy to clipboard', async () => {
    const mark = { text: 't', note: 'n' } as any
    const result = await copyMarkText(mark)
    expect(result).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('标记：t\n备注：n')
  })
})
