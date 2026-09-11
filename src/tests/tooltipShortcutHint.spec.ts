import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { storage as mockedStorage } from 'webextension-polyfill'
import Tooltip from '~/contentScripts/views/Tooltip.vue'
import { settings } from '~/logic/settings'
import type { AnchorRect } from '~/logic/tooltipPosition'

// webext-bridge 的 content-script 入口有环境守卫（jsdom 下直接 throw），
// Tooltip 顶层导入 sendMessage——仅 mock 该环境守卫，行为走真实组件代码
vi.mock('webext-bridge/content-script', () => ({
  sendMessage: vi.fn(async () => ({})),
}))

const anchor: AnchorRect = { top: 100, left: 100, width: 200, height: 20 }
const mountOptions = { global: { stubs: ['transition'] } }

interface Exposed {
  show: (a: AnchorRect, highlighted: boolean, note?: string, color?: string, text?: string, tags?: string[], pointer?: { x: number, y: number }) => Promise<void>
}

async function showTooltip(wrapper: ReturnType<typeof mount>) {
  await (wrapper.vm as unknown as Exposed).show(anchor, false)
  await nextTick()
}

describe('tooltip shortcut hint（一次性快捷键提示）', () => {
  beforeEach(() => {
    settings.value.tooltipShortcutHintDone = false
    settings.value.shortcutSave = 'Alt+S'
    settings.value.shortcutDelete = 'Alt+D'
  })

  it('首次打开：提示行存在，键帽动态读设置值，且显示即置位', async () => {
    settings.value.shortcutSave = 'Ctrl+Shift+S'
    const wrapper = mount(Tooltip, mountOptions)
    await showTooltip(wrapper)
    const hint = wrapper.find('.shortcut-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('Ctrl+Shift+S')
    expect(hint.text()).toContain('Alt+D')
    expect(hint.text()).toContain('保存')
    expect(hint.text()).toContain('删除')
    expect(settings.value.tooltipShortcutHintDone).toBe(true)
  })

  it('已置位：提示行不存在', async () => {
    settings.value.tooltipShortcutHintDone = true
    const wrapper = mount(Tooltip, mountOptions)
    await showTooltip(wrapper)
    expect(wrapper.find('.shortcut-hint').exists()).toBe(false)
  })

  it('对比度回归：kbd 带显式文字色，行文字不用 gray-500（继承 muted 色在键帽底上近不可读）', async () => {
    const wrapper = mount(Tooltip, mountOptions)
    await showTooltip(wrapper)
    const hint = wrapper.find('.shortcut-hint')
    expect(hint.classes()).toContain('text-gray-400')
    expect(hint.classes()).not.toContain('dark:text-gray-500')
    for (const kbd of wrapper.findAll('.shortcut-hint kbd')) {
      expect(kbd.classes()).toContain('text-gray-600')
      expect(kbd.classes()).toContain('dark:text-gray-200')
    }
  })

  it('写放大回归：置位后重复 show() 不再触发 settings 落盘（Vue 同值赋值不触发 watch）', async () => {
    const wrapper = mount(Tooltip, mountOptions)
    await showTooltip(wrapper) // 首次：undefined → true，应有一次落盘
    expect(settings.value.tooltipShortcutHintDone).toBe(true)
    const setMock = vi.mocked(mockedStorage.local.set)
    setMock.mockClear()
    await showTooltip(wrapper) // 重复：true → true，同值赋值不应触发 deep watch 写
    await nextTick()
    await Promise.resolve()
    const settingsWrites = setMock.mock.calls.filter(args =>
      args[0] && typeof args[0] === 'object' && 'webext-settings' in (args[0] as Record<string, unknown>))
    expect(settingsWrites.length).toBe(0)
  })
})
