import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ContentChangeMonitor } from '../contentScripts/monitor'
import { HighlightStateManager } from '../contentScripts/state'

describe('ContentChangeMonitor', () => {
  let state: HighlightStateManager
  let restoreCallback: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    state = new HighlightStateManager()
    restoreCallback = vi.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with null observer', () => {
    const monitor = new ContentChangeMonitor(state, restoreCallback)
    expect(monitor).toBeDefined()
  })

  it('setupBodyObserver should create MutationObserver', () => {
    const monitor = new ContentChangeMonitor(state, restoreCallback)
    monitor.setupBodyObserver()
    expect(monitor).toBeDefined()
  })

  it('setupSPAListener should add popstate listener', () => {
    const monitor = new ContentChangeMonitor(state, restoreCallback)
    monitor.setupSPAListener()
    expect(monitor).toBeDefined()
  })

  it('setupGlobalObserver should override pushState', () => {
    const monitor = new ContentChangeMonitor(state, restoreCallback)
    monitor.setupGlobalObserver()
    expect(monitor).toBeDefined()
  })

  it('destroy should clean up observer', () => {
    const monitor = new ContentChangeMonitor(state, restoreCallback)
    monitor.setupBodyObserver()
    monitor.setupGlobalObserver()
    monitor.setupSPAListener()
    expect(() => monitor.destroy()).not.toThrow()
  })

  it('destroy should restore original pushState', () => {
    const originalPushState = history.pushState
    const monitor = new ContentChangeMonitor(state, restoreCallback)
    monitor.setupGlobalObserver()
    monitor.destroy()
    expect(history.pushState).toBe(originalPushState)
  })

  it('should not call restoreCallback when already restoring', () => {
    const monitor = new ContentChangeMonitor(state, restoreCallback)
    state.isRestoring = true
    monitor['debouncedRestore']()
    vi.advanceTimersByTime(500)
    expect(restoreCallback).not.toHaveBeenCalled()
  })

  it('should call restoreCallback after debounce delay', () => {
    const monitor = new ContentChangeMonitor(state, restoreCallback)
    monitor['debouncedRestore']()
    vi.advanceTimersByTime(300)
    expect(restoreCallback).toHaveBeenCalledTimes(1)
  })

  it('should debounce multiple rapid calls', () => {
    const monitor = new ContentChangeMonitor(state, restoreCallback)
    monitor['debouncedRestore']()
    monitor['debouncedRestore']()
    monitor['debouncedRestore']()
    vi.advanceTimersByTime(300)
    expect(restoreCallback).toHaveBeenCalledTimes(1)
  })

  it('pushState override should trigger debounced restore', () => {
    const monitor = new ContentChangeMonitor(state, restoreCallback)
    monitor.setupGlobalObserver()
    history.pushState({}, '', '/new-url')
    vi.advanceTimersByTime(300)
    expect(restoreCallback).toHaveBeenCalledTimes(1)
  })
})
