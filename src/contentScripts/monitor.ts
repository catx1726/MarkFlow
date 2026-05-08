export class ContentChangeMonitor {
  private debounceTimer: number = 0
  private observer: MutationObserver | null = null
  private originalPushState: typeof history.pushState | null = null
  private boundSPAChange: () => void

  constructor(
    private restoreCallback: () => Promise<void>,
  ) {
    this.boundSPAChange = () => this.debouncedRestore()
  }

  setupGlobalObserver() {
    const self = this
    this.originalPushState = history.pushState
    history.pushState = function (...args) {
      self.originalPushState!.apply(this, args)
      self.debouncedRestore()
    }
  }

  setupBodyObserver() {
    this.observer = new MutationObserver((mutations) => {
      const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0)
      if (!hasAddedNodes) return
      this.debouncedRestore()
    })
    this.observer.observe(document.body, { childList: true, subtree: true })
  }

  setupSPAListener() {
    window.addEventListener('popstate', this.boundSPAChange)
  }

  private debouncedRestore() {
    clearTimeout(this.debounceTimer)
    this.debounceTimer = window.setTimeout(async () => {
      await this.restoreCallback()
    }, 300) as unknown as number
  }

  destroy() {
    this.observer?.disconnect()
    this.observer = null
    if (this.originalPushState) {
      history.pushState = this.originalPushState
      this.originalPushState = null
    }
    window.removeEventListener('popstate', this.boundSPAChange)
    clearTimeout(this.debounceTimer)
  }
}
