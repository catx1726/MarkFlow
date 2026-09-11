import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CoachTip from '~/contentScripts/views/CoachTip.vue'
import type { AnchorRect } from '~/logic/tooltipPosition'

// jsdom 无布局，getBoundingClientRect 返回 0，computeTooltipPosition 对 0 尺寸照常钳制不抛错
const anchor: AnchorRect = { top: 100, left: 100, width: 200, height: 20 }

// stub 掉 Transition，避免 leave 动画的异步钩子让 v-if 移除滞后
const mountOptions = { global: { stubs: ['transition'] } }

interface Exposed { show: (a: AnchorRect) => Promise<void>, hide: () => void }

async function showTip(wrapper: ReturnType<typeof mount>) {
  await (wrapper.vm as unknown as Exposed).show(anchor)
  await nextTick()
}

describe('coachTip.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('show() 后可见，文案含 Alt 键帽与提示语', async () => {
    const wrapper = mount(CoachTip, mountOptions)
    await showTip(wrapper)
    expect(wrapper.find('.coach-tip').exists()).toBe(true)
    expect(wrapper.text()).toContain('Alt')
    expect(wrapper.text()).toContain('划词即可标记')
  })

  it('hide() 后不可见', async () => {
    const wrapper = mount(CoachTip, mountOptions)
    await showTip(wrapper)
    ;(wrapper.vm as unknown as Exposed).hide()
    await nextTick()
    expect(wrapper.find('.coach-tip').exists()).toBe(false)
  })

  it('任意 mousedown 立即隐藏（点击穿透通道）', async () => {
    const wrapper = mount(CoachTip, mountOptions)
    await showTip(wrapper)
    window.dispatchEvent(new MouseEvent('mousedown'))
    await nextTick()
    expect(wrapper.find('.coach-tip').exists()).toBe(false)
  })

  it('页面滚动立即隐藏（防脱锚通道）', async () => {
    const wrapper = mount(CoachTip, mountOptions)
    await showTip(wrapper)
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(wrapper.find('.coach-tip').exists()).toBe(false)
  })

  it('6s 超时自动隐藏', async () => {
    const wrapper = mount(CoachTip, mountOptions)
    await showTip(wrapper)
    vi.advanceTimersByTime(6000)
    await nextTick()
    expect(wrapper.find('.coach-tip').exists()).toBe(false)
  })

  it('重复 show() 重置超时——旧定时器不提前隐藏', async () => {
    const wrapper = mount(CoachTip, mountOptions)
    await showTip(wrapper)
    vi.advanceTimersByTime(5000)
    await (wrapper.vm as unknown as Exposed).show(anchor)
    await nextTick()
    vi.advanceTimersByTime(2000)
    await nextTick()
    // 旧定时器（距首次 show 7s）不得隐藏；新定时器刚过 2s
    expect(wrapper.find('.coach-tip').exists()).toBe(true)
    vi.advanceTimersByTime(4000)
    await nextTick()
    expect(wrapper.find('.coach-tip').exists()).toBe(false)
  })
})
