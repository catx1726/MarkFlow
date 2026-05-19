import { describe, expect, it, vi, beforeEach } from 'vitest'
import { collectError, STORAGE_KEY } from '../logic/errorCollector'

describe('errorCollector filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 模拟 chrome API
    global.chrome = {
      runtime: {
        getURL: vi.fn().mockReturnValue('chrome-extension://test-id/')
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined)
        }
      }
    } as any
  })

  it('应该捕获来自插件的错误 (匹配 stack)', async () => {
    const error = new Error('Plugin Error')
    error.stack = 'Error: Plugin Error\n    at Object.initialize (chrome-extension://test-id/dist/contentScripts/index.global.js:1:1)'
    
    await collectError(error, 'content')
    
    expect(chrome.storage.local.set).toHaveBeenCalled()
    const callArgs = (chrome.storage.local.set as any).mock.calls[0][0]
    expect(callArgs[STORAGE_KEY][0].message).toBe('Plugin Error')
  })

  it('应该过滤掉来自外部网页的错误', async () => {
    const error = new Error('External Site Error')
    error.stack = 'Error: External Site Error\n    at https://baidu.com/js/main.js:10:20'
    
    await collectError(error, 'content')
    
    expect(chrome.storage.local.set).not.toHaveBeenCalled()
  })

  it('应该根据 filename 捕获错误', async () => {
    const error = {
      message: 'Filename Error',
      filename: 'chrome-extension://test-id/logic.js'
    }
    
    await collectError(error, 'content')
    
    expect(chrome.storage.local.set).toHaveBeenCalled()
  })

  it('应该支持 ErrorEvent 对象', async () => {
    // 模拟 ErrorEvent
    const errorObj = new Error('Inner Error')
    errorObj.stack = 'at chrome-extension://test-id/content.js:1:1'
    
    const event = {
      message: 'Event Error',
      filename: 'chrome-extension://test-id/content.js',
      error: errorObj
    }
    // 注意：在测试环境下可能需要手动模拟 instanceof 如果环境不支持真正的 ErrorEvent
    
    await collectError(event, 'content')
    
    expect(chrome.storage.local.set).toHaveBeenCalled()
    const callArgs = (chrome.storage.local.set as any).mock.calls[0][0]
    expect(callArgs[STORAGE_KEY][0].message).toBe('Event Error')
  })
})
