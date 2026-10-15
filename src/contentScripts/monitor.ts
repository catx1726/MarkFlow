/**
 * 判断节点是否位于输入控件（input/textarea/contenteditable）子树内。
 * 打字类 DOM 变更不应触发高亮恢复：既无恢复价值，又会以 300ms 周期
 * 重触发搜索兜底造成输入卡顿（issue #91）。
 *
 * isContentEditable 本身已含祖先链渲染语义（一次调用即可判定整条链），
 * 但部分环境（jsdom）不可靠，故辅以属性级检查；属性级检查只看当前
 * 元素，祖先上的 contenteditable 声明由外层循环补足（PR #92 CR Nit 1）。
 */
function isFromTypingContext(node: Node): boolean {
  let el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  while (el) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
      return true
    if (el instanceof HTMLElement && (el.isContentEditable || isContentEditableAttr(el)))
      return true
    el = el.parentElement
  }
  return false
}

function isContentEditableAttr(el: HTMLElement): boolean {
  // contenteditable="" 等价 "true"；"inherit" 按规范继承父级，此处判 false
  // （若父级为 false 则该元素实际不可编辑，判 true 会误静默真实变更，
  // PR #92 CR3 Nit 1）——继承语义交由 isContentEditable 及外层祖先遍历
  // 命中真实 editable 祖先处理。保守方向：仅拦截确定的编辑区
  const attr = el.getAttribute('contenteditable')
  return attr !== null && attr !== 'false' && attr !== 'inherit'
}

/** 增量恢复的最小间隔：持续滚动时合并变更，避免高频小 pass */
const INCREMENTAL_MIN_INTERVAL_MS = 1000

export class ContentChangeMonitor {
  private debounceTimer: number = 0
  private observer: MutationObserver | null = null
  private originalPushState: typeof history.pushState | null = null
  private boundSPAChange: () => void

  /** 防抖窗口内累积的新增子树根（增量搜索范围） */
  private pendingAddedRoots = new Set<Element>()
  /** 待执行的 pass 是否为全量（SPA 导航会覆盖增量语义） */
  private pendingFullPass = false
  private lastIncrementalAt = 0

  constructor(
    private restoreCallback: (scopeRoots?: Element[]) => Promise<void>,
  ) {
    this.boundSPAChange = () => this.debouncedRestore(false)
  }

  setupGlobalObserver() {
    // pushState 需保持 function 形态（调用方以目标 history 为 this），
    // 故经局部引用桥接，避免 this 别名
    this.originalPushState = history.pushState
    const original = this.originalPushState
    const debouncedRestore = () => this.debouncedRestore(false)
    history.pushState = function (...args) {
      original.apply(this, args)
      debouncedRestore()
    }
  }

  setupBodyObserver() {
    this.observer = new MutationObserver((mutations) => {
      const relevant = mutations.filter(m => m.addedNodes.length > 0)
      if (relevant.length === 0)
        return
      // 打字类变更静默：所有变更均源自输入上下文时跳过恢复
      if (relevant.every(m => isFromTypingContext(m.target)))
        return
      this.collectAddedRoots(relevant)
      this.debouncedRestore(true)
    })
    this.observer.observe(document.body, { childList: true, subtree: true })
  }

  /**
   * 收集新增子树根作为增量搜索范围。去重次序（PR #92 CR2 Blocking #3）：
   * 先判"新根是否已被现存根覆盖"（covered 则直接跳过，不做任何修改），
   * 未覆盖才两趟独立遍历（先收集待删项再删除，杜绝 Set 迭代中修改）。
   * 无论 candidates 顺序如何，最终收敛到最小覆盖集合。
   */
  private collectAddedRoots(mutations: MutationRecord[]) {
    const candidates: Element[] = []
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (isFromTypingContext(node))
          continue
        const root = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
        if (!root || !root.isConnected)
          continue
        candidates.push(root)
      }
    }
    for (const root of candidates) {
      // 前置判定：已被现存根覆盖则整体跳过（先判后改，避免中途状态）
      let covered = false
      for (const existing of this.pendingAddedRoots) {
        if (existing.contains(root)) {
          covered = true
          break
        }
      }
      if (covered)
        continue

      // 未被覆盖：收集被新根覆盖的旧根（两趟遍历，不边迭代边删）
      const superseded: Element[] = []
      for (const existing of this.pendingAddedRoots) {
        if (root.contains(existing))
          superseded.push(existing)
      }
      for (const item of superseded)
        this.pendingAddedRoots.delete(item)

      this.pendingAddedRoots.add(root)
    }
  }

  setupSPAListener() {
    window.addEventListener('popstate', this.boundSPAChange)
  }

  /**
   * @param incremental true = observer 触发的增量恢复（仅搜新增子树）；
   *                   false = SPA 导航等全量恢复，全量语义覆盖增量
   */
  private debouncedRestore(incremental: boolean) {
    if (!incremental)
      this.pendingFullPass = true
    clearTimeout(this.debounceTimer)
    let delay = document.readyState === 'complete' ? 300 : 100
    if (!this.pendingFullPass) {
      // 增量 pass：到期时间不早于上次增量后 1s（节流窗），被合并的 roots 延后一并处理
      const sinceLast = Date.now() - this.lastIncrementalAt
      delay = Math.max(delay, INCREMENTAL_MIN_INTERVAL_MS - sinceLast)
    }
    this.debounceTimer = window.setTimeout(async () => {
      const fullPass = this.pendingFullPass
      this.pendingFullPass = false
      if (fullPass) {
        // 全量：丢弃累积的增量范围（全量为超集）
        this.pendingAddedRoots.clear()
        await this.restoreCallback()
        return
      }
      if (this.pendingAddedRoots.size === 0)
        return
      this.lastIncrementalAt = Date.now()
      const scopeRoots = Array.from(this.pendingAddedRoots)
      this.pendingAddedRoots.clear()
      await this.restoreCallback(scopeRoots)
    }, delay) as unknown as number
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
    this.pendingAddedRoots.clear()
    this.pendingFullPass = false
  }
}
