import { describe, expect, it, vi } from 'vitest'
import { storage } from 'webextension-polyfill'
import { useWebExtensionStorage } from '../composables/useWebExtensionStorage'

// 模拟 webextension-polyfill 的 storage
vi.mock('webextension-polyfill', () => ({
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
}))

describe('storage Fix', () => {
  it('should NOT write default values to storage during initialization by default', async () => {
    // 模拟存储为空
    vi.mocked(storage.local.get).mockResolvedValue({})
    const setSpy = vi.spyOn(storage.local, 'set')

    // 初始化 composable，默认 initialValue 为 { a: 1 }
    // 在修复前，writeDefaults 默认为 true，这会触发 storage.local.set
    const { dataReady } = useWebExtensionStorage('test-key', { a: 1 })
    await dataReady

    // 期望：不应该调用 set (修复后应为真)
    expect(setSpy).not.toHaveBeenCalled()
  })
})
