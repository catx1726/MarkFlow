import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('storage Fix Refinement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should NOT write default values to storage during initialization by default', async () => {
    vi.mocked(storage.local.get).mockResolvedValue({})
    const setSpy = vi.spyOn(storage.local, 'set')

    const { dataReady } = useWebExtensionStorage('test-key', { a: 1 })
    await dataReady

    expect(setSpy).not.toHaveBeenCalled()
  })

  it('should merge defaults when mergeDefaults is true even if writeDefaults is false', async () => {
    // 模拟磁盘上有旧数据，缺少字段 'b'
    vi.mocked(storage.local.get).mockResolvedValue({ 'test-key': { a: 1 } })

    const { data, dataReady } = useWebExtensionStorage('test-key', { a: 0, b: 2 }, { mergeDefaults: true })
    await dataReady

    // 应该保留磁盘上的 a: 1，并补充默认的 b: 2
    expect(data.value).toEqual({ a: 1, b: 2 })
  })

  it('should handle initialization timeout gracefully (simulated)', async () => {
    // 模拟一个极慢的存储读取
    let resolveGet: any
    const slowPromise = new Promise((resolve) => {
      resolveGet = resolve
    })
    vi.mocked(storage.local.get).mockReturnValue(slowPromise as any)

    const { data, dataReady } = useWebExtensionStorage('timeout-key', { initial: true })

    // 在这里我们不等待 dataReady，因为它是 storage 层的 Promise
    // 真正的超时守卫在 background/main.ts 的 ensureReady 中
    // 这里我们验证 data.value 在就绪前是 initialValue
    expect(data.value).toEqual({ initial: true })

    // 模拟读取完成
    resolveGet({ 'timeout-key': { initial: false } })
    await dataReady
    expect(data.value).toEqual({ initial: false })
  })
})
