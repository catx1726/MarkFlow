import { sendMessage } from 'webext-bridge/content-script'
import rangy from 'rangy/lib/rangy-core'
import type { Mark } from '~/logic/storage'
import { highlightDefaultStyle } from '~/logic/config'
import { settings } from '~/logic/settings'
import {
  applyPreciseHighlight,
  calculateSimilarity,
  getCanonicalUrlForMark,
  getHighlightContext,
  getElementSelector,
  querySelectorAllDeep,
  querySelectorDeep,
  stripHighlights,
} from '~/logic/dom'
import { findCandidateElements } from '~/logic/search'
import type { HighlightStateManager } from './state'

const L1_SIMILARITY_THRESHOLD = 95
const CONTEXT_SIMILARITY_THRESHOLD = 80
const L3_SIMILARITY_THRESHOLD = 75

export class HighlightRestorer {
  constructor(
    private state: HighlightStateManager,
  ) {}

  async restoreHighlights() {
    if (this.state.isRestoring) return
    this.state.isRestoring = true
    try {
      const canonicalUrl = getCanonicalUrlForMark()
      const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')
      if (!marks || marks.length === 0) return
      this.state.ambiguousMarksQueue.value = []

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

      // 核心修复：按 domIndex 降序排列（从文档末尾向开头恢复）
      // 这样前面的节点分裂不会影响后面节点的 Rangy 路径偏移
      marksToRestore.sort((a, b) => {
        if (a.domIndex !== undefined && b.domIndex !== undefined)
          return b.domIndex - a.domIndex
        return b.createdAt - a.createdAt // 降序作为次选
      })

      if (marksToRestore.length > 0) await this.applyMarks(marksToRestore)

      if (this.state.ambiguousMarksQueue.value.length > 0) {
        console.log(`[WebMarker] Showing modal with ${this.state.ambiguousMarksQueue.value.length} ambiguous marks`)
        this.state.disambiguationModalApp?.show(this.state.ambiguousMarksQueue.value)
      }
    } finally {
      this.state.isRestoring = false
    }
  }

  async applyMarks(marks: Mark[]) {
    for (const mark of marks) {
      const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
        elementTagName: 'span',
        elementAttributes: { style: highlightDefaultStyle(mark.color) },
      })
      let deserializationRoot: Node | undefined
      if (mark.shadowHostSelector) {
        let host: Element | null = null
        if (mark.shadowHostSelector.includes('|>>>|')) {
          const chain = mark.shadowHostSelector.split('|>>>|')
          let currentRoot: Document | ShadowRoot = document
          for (const selector of chain) {
            host = currentRoot.querySelector(selector)
            if (host && host.shadowRoot) currentRoot = host.shadowRoot
            else {
              host = null
              break
            }
          }
        } else {
          host = querySelectorDeep(mark.shadowHostSelector)
        }
        if (host && host.shadowRoot) deserializationRoot = host.shadowRoot
        else return
      }
      try {
        const range = rangy.deserializeRange(mark.rangySerialized, deserializationRoot, document)
        if (!range) throw new Error('Failed to deserialize range')

        const rangeText = range.toString().trim()
        const markText = mark.text.trim()
        const contentSim = calculateSimilarity(rangeText, markText)

        if (contentSim < L1_SIMILARITY_THRESHOLD) {
          throw new Error('Content mismatch at path')
        }

        if (mark.surroundingSnippet) {
          const currentContext = getHighlightContext(range)
          const contextSim = calculateSimilarity(currentContext.surroundingSnippet, mark.surroundingSnippet)

          if (contextSim < CONTEXT_SIMILARITY_THRESHOLD) {
            throw new Error('Context integrity mismatch')
          }
        }
        applier.applyToRange(range)
        this.state.restoredMarkIds.add(mark.id)
        this.state.failedRestoreCooldowns.delete(mark.id)
      } catch (e) {
        const root = deserializationRoot || document.documentElement

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
              const root = candidate.candidateElement.getRootNode()
              const newSerialized = rangy.serializeRange(range, true, root instanceof ShadowRoot ? root : undefined)
              const { contextTitle, contextSelector, contextLevel, contextOrder, surroundingSnippet } =
                getHighlightContext(range)

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
                await sendMessage(
                  'update-mark-details',
                  {
                    id: mark.id,
                    url: mark.url,
                    text: candidate.displayTextSnippet,
                    html: actualHtml,
                    rangySerialized: newSerialized,
                    shadowHostSelector: shadowHostSelector || null,
                    contextTitle,
                    contextSelector,
                    contextLevel,
                    contextOrder,
                    surroundingSnippet,
                  } as any,
                  'background',
                )
              }
            } else {
              console.warn(`[WebMarker] applyPreciseHighlight failed for ${mark.id}, forcing modal.`)
              const otherMarksInQueue = this.state.ambiguousMarksQueue.value.filter((m) => m.originalMarkId !== mark.id)
              this.state.ambiguousMarksQueue.value = [...otherMarksInQueue, candidate]
            }
          } else {
            console.warn(`[WebMarker] Unique candidate context similarity (${similarity}%) low, forcing modal for ${mark.id}`)
            const otherMarksInQueue = this.state.ambiguousMarksQueue.value.filter((m) => m.originalMarkId !== mark.id)
            this.state.ambiguousMarksQueue.value = [...otherMarksInQueue, candidate]
          }
        } else if (ambiguityLevel === 'multiple') {
          const otherMarksInQueue = this.state.ambiguousMarksQueue.value.filter((m) => m.originalMarkId !== mark.id)
          this.state.ambiguousMarksQueue.value = [...otherMarksInQueue, ...candidates]
        } else {
          this.state.failedRestoreCooldowns.set(mark.id, Date.now() + 3000)
        }
      }
    }
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
