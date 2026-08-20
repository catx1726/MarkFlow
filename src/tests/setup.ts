/**
 * Vitest 全局 setup：i18n 字典经 `~/logic/settings` 依赖 webextension-polyfill，
 * 而 jsdom 环境没有 WebExtension API（polyfill 在模块加载时直接 throw）。
 * 这里全局 mock 最小可用的 storage 面，使纯逻辑模块（sync/dom/tagTree 等）
 * 引入 t() 后测试仍可运行；t() 在该环境回退到 zh-CN 源语言字典。
 */
import { vi } from 'vitest'

vi.mock('webextension-polyfill', () => ({
  default: {},
  storage: {
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
}))
