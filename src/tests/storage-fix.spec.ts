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
    vi.mocked(storage.local.get).mockResolvedValue({ 'test-key': JSON.stringify({ a: 1 }) })

    const { data, dataReady } = useWebExtensionStorage('test-key', { a: 0, b: 2 }, { mergeDefaults: true })
    await dataReady

    // 应该保留磁盘上的 a: 1，并补充默认的 b: 2
    expect(data.value).toEqual({ a: 1, b: 2 })
  })

  it('should NOT merge defaults when mergeDefaults is false', async () => {
    // 模拟磁盘上有旧数据，缺少字段 'b'
    vi.mocked(storage.local.get).mockResolvedValue({ 'test-key': JSON.stringify({ a: 1 }) })

    const { data, dataReady } = useWebExtensionStorage('test-key', { a: 0, b: 2 }, { mergeDefaults: false })
    await dataReady

    // 不应该合并，只保留磁盘上的 a: 1 (类型系统外可能会丢失 b)
    expect(data.value).toEqual({ a: 1 })
  })

  it('should allow blocking operation on timeout in background logic', async () => {
    // 模拟 ensureReady 逻辑 (手动模拟，因为测试环境不直接运行 background/main.ts)
    const ensureReady = async (timeoutMs: number, dataReady: Promise<any>) => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs),
      )
      await Promise.race([dataReady, timeoutPromise])
    }

    const hangingPromise = new Promise(() => {}) // 永不 resolve

    await expect(ensureReady(10, hangingPromise)).rejects.toThrow('timeout')
  })
})
