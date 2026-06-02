import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStorageMonitor } from '../useStorageMonitor'

// Mock webextension-polyfill
vi.mock('webextension-polyfill', () => {
  const browser = {
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
    default: browser,
    storage: browser.storage,
    runtime: browser.runtime,
    browser,
  }
})

vi.mock('webext-bridge/options', () => ({
  sendMessage: vi.fn(),
}))

describe('useStorageMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock confirm
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('should initialize with default values', () => {
    const { storageUsage, storageQuota, storageUsagePercent } = useStorageMonitor()
    expect(storageUsage.value).toBe(0)
    expect(storageQuota.value).toBe(0)
    expect(storageUsagePercent.value).toBe(0)
  })

  it('should refresh usage', async () => {
    const { sendMessage } = await import('webext-bridge/options')
    vi.mocked(sendMessage).mockResolvedValue({ usage: 1024, quota: 10240 })

    const { storageUsage, storageQuota, storageUsagePercent, refreshUsage } = useStorageMonitor()
    await refreshUsage()

    expect(storageUsage.value).toBe(1024)
    expect(storageQuota.value).toBe(10240)
    expect(storageUsagePercent.value).toBe(10)
    expect(sendMessage).toHaveBeenCalledWith('get-storage-usage', undefined, 'background')
  })
})
