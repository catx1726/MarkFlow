import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Tooltip from '~/contentScripts/views/Tooltip.vue'
import { settings } from '~/logic/settings'

// webext-bridge 的 content-script 入口有环境守卫（jsdom 下直接 throw），
// Tooltip 顶层导入 sendMessage——仅 mock 该环境守卫，行为走真实组件代码
vi.mock('webext-bridge/content-script', () => ({
  sendMessage: vi.fn(async () => ({})),
}))

const anchor = { top: 100, left: 100, width: 200, height: 20 }
const mountOptions = { global: { stubs: ['transition'] } }

interface Exposed {
  show: (a: typeof anchor, highlighted: boolean, note?: string, color?: string, text?: string, tags?: string[], pointer?: { x: number, y: number }) => Promise<void>
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
})
