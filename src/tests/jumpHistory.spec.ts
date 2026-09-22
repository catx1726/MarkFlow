import type { MockInstance } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JumpHistoryManager, MAX_DEPTH } from '../contentScripts/jumpHistory'

describe('jumpHistoryManager', () => {
  let history: JumpHistoryManager
  let scrollToSpy: MockInstance

  beforeEach(() => {
    history = new JumpHistoryManager()
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    setWindowScroll(0, 0)
    document.body.innerHTML = ''
  })

  function setWindowScroll(x: number, y: number) {
    Object.defineProperty(window, 'scrollX', { value: x, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  }

  function createScrollableAncestor(target: HTMLElement, scrollTop: number) {
    const ancestor = document.createElement('div')
    document.body.appendChild(ancestor)
    Object.defineProperty(ancestor, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(ancestor, 'clientHeight', { value: 200, configurable: true })
    ancestor.style.overflowY = 'auto'
    ancestor.scrollTop = scrollTop
    ancestor.appendChild(target)
    return ancestor
  }

  it('空栈 restore 返回 false 且不滚动', () => {
    expect(history.depth).toBe(0)
    expect(history.restore()).toBe(false)
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  it('capture 记录 window 位置，restore 恢复并减深度', () => {
    const target = document.createElement('span')
    document.body.appendChild(target)
    setWindowScroll(0, 300)
    history.capture(target)

    setWindowScroll(0, 5000)
    expect(history.depth).toBe(1)
    expect(history.restore()).toBe(true)
    expect(scrollToSpy).toHaveBeenCalledWith(0, 300)
    expect(history.depth).toBe(0)
  })

  it('capture 记录可滚动祖先，restore 恢复其 scrollTop', () => {
    const target = document.createElement('span')
    const ancestor = createScrollableAncestor(target, 120)
    history.capture(target)

    ancestor.scrollTop = 800
    expect(history.restore()).toBe(true)
    expect(ancestor.scrollTop).toBe(120)
  })

  it('非滚动容器不入栈', () => {
    const wrapper = document.createElement('div')
    const target = document.createElement('span')
    wrapper.appendChild(target)
    document.body.appendChild(wrapper)
    history.capture(target)

    expect(history.restore()).toBe(true)
    expect(scrollToSpy).toHaveBeenCalledTimes(1)
  })

  it('多级栈按 LIFO 顺序恢复', () => {
    const target = document.createElement('span')
    document.body.appendChild(target)
    setWindowScroll(0, 100)
    history.capture(target)
    setWindowScroll(0, 200)
    history.capture(target)

    expect(history.depth).toBe(2)
    history.restore()
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, 200)
    history.restore()
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, 100)
  })

  it('超过 MAX_DEPTH 丢弃最底层', () => {
    const target = document.createElement('span')
    document.body.appendChild(target)
    for (let i = 1; i <= MAX_DEPTH + 5; i++) {
      setWindowScroll(0, i)
      history.capture(target)
    }

    expect(history.depth).toBe(MAX_DEPTH)
    history.restore()
    expect(scrollToSpy).toHaveBeenLastCalledWith(0, MAX_DEPTH + 5)
  })

  it('祖先已脱离 DOM 时跳过该层，仅恢复 window 位置', () => {
    const target = document.createElement('span')
    const ancestor = createScrollableAncestor(target, 120)
    history.capture(target)
    ancestor.remove()

    expect(history.restore()).toBe(true)
    expect(scrollToSpy).toHaveBeenCalled()
  })

  it('穿透 shadow DOM 记录可滚动祖先', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const inner = document.createElement('div')
    Object.defineProperty(inner, 'scrollHeight', { value: 900, configurable: true })
    Object.defineProperty(inner, 'clientHeight', { value: 150, configurable: true })
    inner.style.overflowY = 'auto'
    inner.scrollTop = 66
    const target = document.createElement('span')
    inner.appendChild(target)
    shadow.appendChild(inner)

    history.capture(target)
    inner.scrollTop = 400
    expect(history.restore()).toBe(true)
    expect(inner.scrollTop).toBe(66)
  })
})
