import { sendMessage } from 'webext-bridge/content-script'
import rangy from 'rangy/lib/rangy-core'
import type { Mark } from '~/logic/storage'
import { highlightDefaultStyle } from '~/logic/config'
import { settings } from '~/logic/settings'
import {
  applyPreciseHighlight,
  calculateSimilarity,
  DOMScanner,
  getCanonicalUrlForMark,
  getHighlightContext,
  getElementSelector,
  querySelectorAllDeep,
  querySelectorDeep,
  stripHighlights,
} from '~/logic/dom'
import { findCandidateElements, type Candidate } from '~/logic/search'
import type { HighlightStateManager } from './state'

const L1_SIMILARITY_THRESHOLD = 95
const CONTEXT_SIMILARITY_THRESHOLD = 80
const L3_SIMILARITY_THRESHOLD = 75

interface SearchRestoreResult {
  success: boolean
  candidates?: Candidate[]
}

export class HighlightRestorer {
  constructor(
    private state: HighlightStateManager,
  ) {}

  async restoreHighlights(): Promise<Candidate[]> {
    if (this.state.isRestoring) return this.state.ambiguousMarksQueue.value
    this.state.isRestoring = true
    try {
      const canonicalUrl = getCanonicalUrlForMark()
      const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')
      if (!marks || marks.length === 0) return this.state.ambiguousMarksQueue.value

      const now = Date.now()
      const marksToRestore = marks.filter((mark) => {
        if (this.state.restoredMarkIds.has(mark.id)) {
          if (querySelectorDeep(`.webext-highlight-${mark.id}`)) return false
          this.state.restoredMarkIds.delete(mark.id)
        }
        const cooldown = this.state.failedRestoreCooldowns.get(mark.id)
        if (cooldown && now < cooldown) return false
        return true
      })

      // 策略调整：使用升序排列（从文档开头向末尾恢复）
      // 配合两阶段恢复逻辑，可以确保顶部内容第一时间出现，且不会因为底部搜索耗时而阻塞
      marksToRestore.sort((a, b) => {
        if (a.domIndex !== undefined && b.domIndex !== undefined)
          return a.domIndex - b.domIndex
        return a.createdAt - b.createdAt
      })

      if (marksToRestore.length > 0) await this.applyMarksTwoPhases(marksToRestore)

      return this.state.ambiguousMarksQueue.value
    } finally {
      this.state.isRestoring = false
    }
  }

  private async applyMarksTwoPhases(marks: Mark[]) {
    const failedMarks: Mark[] = []

    // 第一阶段：快速路径 (Path Only) - 极速尝试 Rangy 路径，不进行任何耗时的搜索
    for (const mark of marks) {
      const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
        elementTagName: 'span',
        elementAttributes: { style: highlightDefaultStyle(mark.color) },
      })
      const root = this.getDeserializationRoot(mark)
      if (!root) {
        failedMarks.push(mark)
        continue
      }

      try {
        const range = rangy.deserializeRange(mark.rangySerialized, root, document)
        if (range && this.validateRange(range, mark)) {
          applier.applyToRange(range)
          this.state.restoredMarkIds.add(mark.id)
          this.state.failedRestoreCooldowns.delete(mark.id)
          this.state.removeFromAmbiguousQueue(mark.id)
          continue
        }
      } catch {
        // 路径失效，静默处理，留待第二阶段
      }
      failedMarks.push(mark)
    }

    // 第二阶段：回退路径 (Search Fallback) - 处理失效的标记
    // 异步执行，且通过 requestAnimationFrame 避免长任务阻塞 UI
    // 快照当前已恢复的 ID，避免循环过程中状态变化导致重复处理
    const restoredSnapshot = new Set(this.state.restoredMarkIds)
    const marksToSearch = failedMarks.filter(m => !restoredSnapshot.has(m.id))

    for (let i = 0; i < marksToSearch.length; i++) {
      const mark = marksToSearch[i]
      // 双重检查：循环过程中可能被其他路径恢复
      if (this.state.restoredMarkIds.has(mark.id)) continue

      const result = await this.restoreBySearch(mark)
      if (!result.success && result.candidates) {
        this.state.addToAmbiguousQueue(result.candidates)
      }

      // 每处理两个标记让出一次主线程，确保页面交互流畅
      if (i % 2 === 0) await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  }

  private validateRange(range: rangy.RangyRange, mark: Mark): boolean {
    const rangeText = range.toString().trim()
    const markText = mark.text.trim()
    const contentSim = calculateSimilarity(rangeText, markText)

    if (contentSim < L1_SIMILARITY_THRESHOLD) return false

    if (mark.surroundingSnippet) {
      const currentContext = getHighlightContext(range)
      const contextSim = calculateSimilarity(currentContext.surroundingSnippet, mark.surroundingSnippet)
      if (contextSim < CONTEXT_SIMILARITY_THRESHOLD) return false
    }
    return true
  }

  private getDeserializationRoot(mark: Mark): Node | undefined {
    if (!mark.shadowHostSelector) return document.documentElement
    let host: Element | null = null
    if (mark.shadowHostSelector.includes('|>>>|')) {
      const chain = mark.shadowHostSelector.split('|>>>|')
      let currentRoot: Document | ShadowRoot = document
      for (const selector of chain) {
        host = currentRoot.querySelector(selector)
        if (host && host.shadowRoot) currentRoot = host.shadowRoot
        else return undefined
      }
    } else {
      host = querySelectorDeep(mark.shadowHostSelector)
    }
    return (host && host.shadowRoot) ? host.shadowRoot : undefined
  }

  private async restoreBySearch(mark: Mark): Promise<SearchRestoreResult> {
    const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
      elementTagName: 'span',
      elementAttributes: { style: highlightDefaultStyle(mark.color) },
    })
    const deserializationRoot = this.getDeserializationRoot(mark)
    if (mark.shadowHostSelector && !deserializationRoot) {
      console.warn(`[HighlightRestorer] Shadow host not found for ${mark.id}, skipping search fallback.`)
      return { success: false }
    }
    const root = deserializationRoot || document.documentElement

    console.warn(`[HighlightRestorer] Path failed for ${mark.id}, falling back to search.`)
    let { ambiguityLevel, candidates } = findCandidateElements(mark, root, 10)

    if (candidates.length === 0 && root !== document.documentElement) {
      const globalResult = findCandidateElements(mark, document.documentElement, 10)
      ambiguityLevel = globalResult.ambiguityLevel
      candidates = globalResult.candidates
    }

    if (ambiguityLevel === 'unique' && candidates.length === 1) {
      const candidate = candidates[0]
      const similarity = mark.surroundingSnippet
        ? calculateSimilarity(candidate.surroundingSnippet, mark.surroundingSnippet)
        : 100

      if (similarity >= L3_SIMILARITY_THRESHOLD) {
        const rangeResult = applyPreciseHighlight(
          candidate.candidateElement,
          candidate.displayTextSnippet,
          applier,
          candidate.matchIndex,
        )
        if (rangeResult) {
          const { range } = rangeResult
          this.state.restoredMarkIds.add(mark.id)
          this.state.failedRestoreCooldowns.delete(mark.id)
          this.state.removeFromAmbiguousQueue(mark.id)
          
          // 更新逻辑保持不变...
          const root = candidate.candidateElement.getRootNode()
          const newSerialized = rangy.serializeRange(range, true, root instanceof ShadowRoot ? root : undefined)
          const { contextTitle, contextSelector, contextLevel, contextOrder, surroundingSnippet } = getHighlightContext(range)
          let shadowHostSelector: string | undefined
          if (root instanceof ShadowRoot) {
            const chain: string[] = []
            let currRoot: Node = root
            while (currRoot instanceof ShadowRoot) {
              chain.unshift(getElementSelector(currRoot.host))
              currRoot = currRoot.host.getRootNode()
            }
            shadowHostSelector = chain.join('|>>>|')
          }
          const content = range.cloneContents()
          stripHighlights(content)
          const tempDiv = document.createElement('div')
          tempDiv.appendChild(content)
          const actualHtml = content.constructor === DocumentFragment ? tempDiv.innerHTML : range.toString()

          if (similarity >= 90) {
            const newDomIndex = DOMScanner.calculatePreciseOffset(range, root instanceof ShadowRoot ? root : document.body)
            await sendMessage('update-mark-details', {
              id: mark.id, url: mark.url, text: candidate.displayTextSnippet,
              html: actualHtml, rangySerialized: newSerialized,
              shadowHostSelector: shadowHostSelector || null,
              contextTitle, contextSelector, contextLevel, contextOrder, surroundingSnippet,
              domIndex: newDomIndex,
            } as any, 'background')
          }
          return { success: true }
        }
        // applyPreciseHighlight 失败，返回候选者供调用方加入歧义队列
        return { success: false, candidates: [candidate] }
      }
      // similarity 不足，返回候选者供调用方加入歧义队列
      return { success: false, candidates: [candidate] }
    } else if (ambiguityLevel === 'multiple') {
      return { success: false, candidates }
    } else {
      this.state.failedRestoreCooldowns.set(mark.id, Date.now() + 3000)
      return { success: false }
    }
  }

  /**
   * @deprecated Use applyMarksTwoPhases instead.
   */
  async applyMarks(marks: Mark[]) {
    // 此方法已废弃，保留用于向后兼容，内部重定向到两阶段逻辑
    await this.applyMarksTwoPhases(marks)
  }

  async refreshHighlights() {
    const highlights = querySelectorAllDeep('span[class*="webext-highlight-"]')
    const parentsToNormalize = new Set<Node>()
    highlights.forEach((el) => {
      if (el.classList.contains('webext-highlight-preview')) return
      const parent = el.parentNode
      if (parent) {
        parentsToNormalize.add(parent)
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
      }
    })
    parentsToNormalize.forEach((parent) => parent.normalize())
    this.state.restoredMarkIds.clear()
    await this.restoreHighlights()
  }

  async scrollToMark(markId: string) {
    const className = `webext-highlight-${markId}`
    const element = querySelectorDeep(`.${className}`)
    if (element) {
      const mark = await sendMessage('get-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
      if (!mark) return
      element.scrollIntoView({ behavior: 'auto', block: 'center' })
      querySelectorAllDeep(`.${className}`).forEach((el) => {
        if (!(el instanceof HTMLElement)) return
        el.style.transition = 'box-shadow 0.5s ease-in-out'
        el.style.boxShadow = `inset 0 -5px 0 0 ${settings.value.highlightColors[1]}`
        setTimeout(() => {
          el.style.boxShadow = `inset 0 -5px 0 0 ${mark.color}`
        }, 1000)
      })
    }
  }
}
