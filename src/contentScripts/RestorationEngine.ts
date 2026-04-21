import { sendMessage } from 'webext-bridge/content-script'
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-serializer'
import type { AppState, IRestorationEngine } from './types'
import type { Mark } from '~/logic/storage'
import {
  getCanonicalUrlForMark,
  calculateSimilarity,
  getHighlightContext,
  stripHighlights,
  getElementSelector,
  querySelectorDeep,
  Highlighter
} from '~/logic/dom'
import { highlightDefaultStyle } from '~/logic/config'
import { findCandidateElements } from '~/logic/search'

export class RestorationEngine implements IRestorationEngine {
  private restoredMarkIds = new Set<string>()
  private failedRestoreCooldowns = new Map<string, number>()
  private restoreDebounceTimer: number | undefined
  private isRestoring = false

  constructor(private state: AppState, private actions: { onAmbiguity: (candidates: any[]) => void }) {}

  async restore() {
    const canonicalUrl = getCanonicalUrlForMark()
    const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background') as Mark[]
    if (!marks || marks.length === 0) return

    const now = Date.now()
    const marksToRestore = marks.filter((mark) => {
      if (this.restoredMarkIds.has(mark.id)) {
        if (querySelectorDeep(`.webext-highlight-${mark.id}`)) return false
        this.restoredMarkIds.delete(mark.id)
      }
      const cooldown = this.failedRestoreCooldowns.get(mark.id)
      if (cooldown && now < cooldown) return false
      return true
    })

    if (marksToRestore.length > 0) await this.applyMarks(marksToRestore)
  }

  debouncedRestore() {
    if (this.isRestoring) return

    clearTimeout(this.restoreDebounceTimer)
    this.restoreDebounceTimer = window.setTimeout(async () => {
      const canonicalUrl = getCanonicalUrlForMark()
      const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background') as Mark[]
      if (!marks) return

      const now = Date.now()
      const marksToRestore = marks.filter((mark) => {
        if (this.restoredMarkIds.has(mark.id)) {
          if (querySelectorDeep(`.webext-highlight-${mark.id}`)) return false
          this.restoredMarkIds.delete(mark.id)
        }
        const cooldown = this.failedRestoreCooldowns.get(mark.id)
        if (cooldown && now < cooldown) return false
        return true
      })

      if (marksToRestore.length > 0) {
        this.isRestoring = true
        try {
          await this.applyMarks(marksToRestore)
        } finally {
          this.isRestoring = false
        }
      }
    }, 300) as any
  }

  setupObserver() {
    const observer = new MutationObserver((mutations) => {
      const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0)
      if (!hasAddedNodes) return
      this.debouncedRestore()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('popstate', () => this.debouncedRestore())
    const originalPushState = history.pushState
    history.pushState = (data: any, unused: string, url?: string | URL | null) => {
      originalPushState.call(history, data, unused, url)
      this.debouncedRestore()
    }
  }

  async applyMarks(marks: Mark[]) {
    for (const mark of marks) {
      const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
        elementTagName: 'span',
        elementAttributes: { style: highlightDefaultStyle(mark.color) }
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
        else continue // host not found
      }
      try {
        const range = (rangy as any).deserializeRange(mark.rangySerialized, deserializationRoot, document)
        if (!range) throw new Error('Failed to deserialize range')

        const rangeText = range.toString().trim()
        const markText = mark.text.trim()
        const contentSim = calculateSimilarity(rangeText, markText)

        if (contentSim < 95) {
          throw new Error('Content mismatch at path')
        }

        if (mark.surroundingSnippet) {
          const currentContext = getHighlightContext(range)
          const contextSim = calculateSimilarity(currentContext.surroundingSnippet, mark.surroundingSnippet)

          if (contextSim < 80) {
            throw new Error('Context integrity mismatch')
          }
        }
        applier.applyToRange(range)
        this.restoredMarkIds.add(mark.id)
        this.failedRestoreCooldowns.delete(mark.id)
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
            ? calculateSimilarity(candidate.displayContext, mark.surroundingSnippet)
            : 100

          if (similarity >= 75) {
            const rangeResult = Highlighter.applyPreciseHighlight(
              candidate.candidateElement,
              candidate.displayTextSnippet,
              applier,
              candidate.matchIndex
            )
            if (rangeResult) {
              const { range } = rangeResult
              this.restoredMarkIds.add(mark.id)
              this.failedRestoreCooldowns.delete(mark.id)
              const root = candidate.candidateElement.getRootNode()
              const newSerialized = (rangy as any).serializeRange(range, true, root instanceof ShadowRoot ? root : undefined)
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
                  surroundingSnippet
                } as any,
                'background'
              )
            } else {
              this.state.ambiguousMarks = [...this.state.ambiguousMarks.filter(m => m.originalMarkId !== mark.id), candidate]
            }
          } else {
            this.state.ambiguousMarks = [...this.state.ambiguousMarks.filter(m => m.originalMarkId !== mark.id), candidate]
          }
        } else if (ambiguityLevel === 'multiple') {
          this.state.ambiguousMarks = [...this.state.ambiguousMarks.filter(m => m.originalMarkId !== mark.id), ...candidates]
        } else {
          this.failedRestoreCooldowns.set(mark.id, Date.now() + 3000)
        }
      }
    }
    if (this.state.ambiguousMarks.length > 0) {
      this.actions.onAmbiguity(this.state.ambiguousMarks)
    }
  }

  getRestoredMarkIds() {
    return this.restoredMarkIds
  }

  clearRestoredMarkIds() {
    this.restoredMarkIds.clear()
  }
}
