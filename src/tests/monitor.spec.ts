import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentChangeMonitor } from '../contentScripts/monitor'

describe('contentChangeMonitor', () => {
  let restoreCallback: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    restoreCallback = vi.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize', () => {
    const monitor = new ContentChangeMonitor(restoreCallback)
    expect(monitor).toBeDefined()
  })

  it('setupBodyObserver should create MutationObserver', () => {
    const monitor = new ContentChangeMonitor(restoreCallback)
    monitor.setupBodyObserver()
    expect(monitor).toBeDefined()
  })

  it('setupSPAListener should add popstate listener', () => {
    const monitor = new ContentChangeMonitor(restoreCallback)
    monitor.setupSPAListener()
    expect(monitor).toBeDefined()
  })

  it('setupGlobalObserver should override pushState', () => {
    const monitor = new ContentChangeMonitor(restoreCallback)
    monitor.setupGlobalObserver()
    expect(monitor).toBeDefined()
  })

  it('destroy should clean up observer', () => {
    const monitor = new ContentChangeMonitor(restoreCallback)
    monitor.setupBodyObserver()
    monitor.setupGlobalObserver()
    monitor.setupSPAListener()
    expect(() => monitor.destroy()).not.toThrow()
  })

  it('destroy should restore original pushState', () => {
    const originalPushState = history.pushState
    const monitor = new ContentChangeMonitor(restoreCallback)
    monitor.setupGlobalObserver()
    monitor.destroy()
    expect(history.pushState).toBe(originalPushState)
  })

  it('should call restoreCallback after debounce delay', async () => {
    const monitor = new ContentChangeMonitor(restoreCallback)
    monitor.setupGlobalObserver()
    history.pushState({}, '', '/debounce-single')
    await vi.advanceTimersByTimeAsync(300)
    expect(restoreCallback).toHaveBeenCalledTimes(1)
  })

  it('should debounce multiple rapid calls', async () => {
    const monitor = new ContentChangeMonitor(restoreCallback)
    monitor.setupGlobalObserver()
    history.pushState({}, '', '/debounce-a')
    history.pushState({}, '', '/debounce-b')
    history.pushState({}, '', '/debounce-c')
    await vi.advanceTimersByTimeAsync(300)
    expect(restoreCallback).toHaveBeenCalledTimes(1)
  })

  it('pushState override should trigger debounced restore', () => {
    const monitor = new ContentChangeMonitor(restoreCallback)
    monitor.setupGlobalObserver()
    history.pushState({}, '', '/new-url')
    vi.advanceTimersByTime(300)
    expect(restoreCallback).toHaveBeenCalledTimes(1)
  })

  describe('typing-context filtering & incremental scope (issue #91)', () => {
    let monitor: ContentChangeMonitor | undefined

    beforeEach(() => {
      document.body.innerHTML = ''
    })

    afterEach(() => {
      monitor?.destroy()
      document.body.innerHTML = ''
    })

    it('textarea 子树内的新增节点不应触发恢复回调', async () => {
      // 输入框为页面预置（observer 启动前已存在），打字产生的变更位于其子树内
      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)
      monitor = new ContentChangeMonitor(restoreCallback)
      monitor.setupBodyObserver()
      textarea.appendChild(document.createTextNode('typed'))
      await vi.advanceTimersByTimeAsync(1000)
      expect(restoreCallback).not.toHaveBeenCalled()
    })

    it('contenteditable 子树内的新增节点不应触发恢复回调', async () => {
      const editor = document.createElement('div')
      editor.setAttribute('contenteditable', 'true')
      document.body.appendChild(editor)
      monitor = new ContentChangeMonitor(restoreCallback)
      monitor.setupBodyObserver()
      editor.appendChild(document.createTextNode('typed'))
      await vi.advanceTimersByTimeAsync(1000)
      expect(restoreCallback).not.toHaveBeenCalled()
    })

    it('输入区外的页面变更应正常触发恢复回调', async () => {
      monitor = new ContentChangeMonitor(restoreCallback)
      monitor.setupBodyObserver()
      const section = document.createElement('section')
      section.textContent = 'new content'
      document.body.appendChild(section)
      await vi.advanceTimersByTimeAsync(300)
      expect(restoreCallback).toHaveBeenCalledTimes(1)
    })

    it('observer 触发应传递新增子树作为增量 scope', async () => {
      monitor = new ContentChangeMonitor(restoreCallback)
      monitor.setupBodyObserver()
      const section = document.createElement('section')
      section.textContent = 'new content'
      document.body.appendChild(section)
      await vi.advanceTimersByTimeAsync(300)
      expect(restoreCallback).toHaveBeenCalledWith([section])
    })

    it('防抖窗口内嵌套新增应去重为最外层子树根', async () => {
      monitor = new ContentChangeMonitor(restoreCallback)
      monitor.setupBodyObserver()
      const wrapper = document.createElement('div')
      document.body.appendChild(wrapper)
      const inner = document.createElement('p')
      wrapper.appendChild(inner)
      await vi.advanceTimersByTimeAsync(300)
      expect(restoreCallback).toHaveBeenCalledWith([wrapper])
    })

    it('同防抖窗口内乱序/移动新增收敛到最小覆盖集合（PR #92 CR2 Blocking #3）', async () => {
      // root 先独立挂载（进入 pending），随后 outer 挂载并把 root 移入——
      // 处理顺序为 [root, outer, root(移动)]，最终应收敛为 {outer}
      const outer = document.createElement('div')
      const root = document.createElement('section')
      monitor = new ContentChangeMonitor(restoreCallback)
      monitor.setupBodyObserver()
      document.body.appendChild(root)
      document.body.appendChild(outer)
      outer.appendChild(root)
      await vi.advanceTimersByTimeAsync(300)
      const call = restoreCallback.mock.lastCall
      const scope: Element[] = call?.[0] ?? []
      expect(scope.length).toBe(1)
      expect(scope[0]).toBe(outer)
      expect(scope[0].contains(root)).toBe(true)
    })

    it('1s 节流窗内的后续增量触发应被延迟合并', async () => {
      monitor = new ContentChangeMonitor(restoreCallback)
      monitor.setupBodyObserver()
      const first = document.createElement('section')
      document.body.appendChild(first)
      await vi.advanceTimersByTimeAsync(300)
      expect(restoreCallback).toHaveBeenCalledTimes(1)

      const second = document.createElement('article')
      document.body.appendChild(second)
      await vi.advanceTimersByTimeAsync(300)
      // 距上次增量不足 1s，被节流延迟
      expect(restoreCallback).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1000)
      expect(restoreCallback).toHaveBeenCalledTimes(2)
      expect(restoreCallback).toHaveBeenLastCalledWith([second])
    })

    it('pushState 触发的全量恢复不携带增量 scope', async () => {
      monitor = new ContentChangeMonitor(restoreCallback)
      monitor.setupBodyObserver()
      monitor.setupGlobalObserver()
      history.pushState({}, '', '/spa-route')
      await vi.advanceTimersByTimeAsync(300)
      expect(restoreCallback).toHaveBeenCalledTimes(1)
      expect(restoreCallback).toHaveBeenLastCalledWith()
    })
  })
})
