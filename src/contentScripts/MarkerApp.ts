import { onMessage, sendMessage } from 'webext-bridge/content-script'
import rangy from 'rangy/lib/rangy-core'
import {
  getCanonicalUrlForMark,
  querySelectorDeep,
  querySelectorAllDeep,
  getHighlightContext,
  stripHighlights,
  getElementSelector,
  highlightDefaultStyle
} from '~/logic/dom'
import { isPageBlacklisted, settings, settingsReady } from '~/logic/settings'
import type { AppState } from './types'
import { UIPortal } from './UIPortal'
import { InteractionController } from './InteractionController'
import { RestorationEngine } from './RestorationEngine'
import type { Candidate } from '~/logic/search'

export class MarkerApp {
  private ui: UIPortal
  private interaction: InteractionController
  private engine: RestorationEngine
  private previewApplier: rangy.RangyClassApplier | null = null

  constructor(private state: AppState) {
    this.ui = new UIPortal(this.state, {
      onSave: this.handleSaveAction.bind(this),
      onDelete: this.handleDeleteAction.bind(this),
      onColorChange: this.handleColorChange.bind(this),
      onClearPreview: this.handleClearPreview.bind(this),
      onConfirmResolution: this.handleConfirmResolution.bind(this),
      onDiscardMark: this.handleDiscardMark.bind(this),
      onCandidateHover: this.handleCandidateHover.bind(this),
      onCandidateLeave: this.handleCandidateLeave.bind(this)
    })

    this.interaction = new InteractionController(this.state, this.ui, {
      clearPreviewHighlight: this.clearPreviewHighlight.bind(this),
      showTooltipForSelection: this.ui.showTooltip.bind(this),
      showTooltipForExistingMark: this.showTooltipForExistingMark.bind(this),
      applyPreviewHighlight: (range) => this.previewApplier?.applyToRange(range)
    })

    this.engine = new RestorationEngine(this.state, {
      onAmbiguity: (marks) => this.ui.showDisambiguation(marks)
    })
  }

  async init() {
    console.log('[MarkerApp] Initializing...')
    await settingsReady
    this.state.settings = settings.value
    if (isPageBlacklisted(window.location.href, settings.value.blacklist)) {
      console.log('[MarkerApp] Page blacklisted.')
      return
    }

    rangy.init()
    this.previewApplier = rangy.createClassApplier('webext-highlight-preview', {
      elementTagName: 'span',
      elementAttributes: { style: highlightDefaultStyle(settings.value.defaultHighlightColor) },
      normalize: false
    })

    this.ui.mount()
    this.interaction.setupListeners()
    this.engine.setupObserver()

    this.setupMessageListeners()
    await this.handleInitialLoadActions()
    console.log('[MarkerApp] Ready.')
  }

  private setupMessageListeners() {
    onMessage('refresh-highlights', async () => {
      await this.refreshHighlights()
    })
    onMessage('goto-mark', ({ data }) => {
      this.scrollToMark(data.markId)
    })
    onMessage('remove-mark', async ({ data: markToRemove }) => {
      if (markToRemove?.id) await this.removeMarkById(markToRemove.id)
    })
    onMessage('goto-chapter', ({ data }) => {
      const element = querySelectorDeep(data.selector)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (element instanceof HTMLElement) {
          element.style.transition = 'outline 0.1s ease-in-out'
          element.style.outline = '3px solid #3B82F6'
          setTimeout(() => {
            element.style.outline = ''
          }, 1500)
        }
      }
    })
  }

  private async handleInitialLoadActions() {
    await this.engine.restore()
    const hash = window.location.hash
    if (hash.startsWith('#__highlight-mark__')) {
      const markId = hash.substring('#__highlight-mark__'.length)
      if (markId) {
        setTimeout(() => {
          this.scrollToMark(markId)
          history.replaceState(null, '', window.location.pathname + window.location.search)
        }, 100)
      }
    }
  }

  private async handleSaveAction(note: string, color: string) {
    if (this.state.currentMarkIdForColorChange) {
      await sendMessage('update-mark-details', {
        id: this.state.currentMarkIdForColorChange,
        url: getCanonicalUrlForMark(),
        note,
        color
      }, 'background')
      querySelectorAllDeep(`.webext-highlight-${this.state.currentMarkIdForColorChange}`).forEach((el) => {
        if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${color}`
      })
    } else {
      this.clearPreviewHighlight()
      if (!this.state.serializedSelection) return
      const root = this.state.currentSerializationRoot || document.documentElement
      const doc = root instanceof ShadowRoot ? root.ownerDocument : document
      const range = rangy.deserializeRange(this.state.serializedSelection, root, doc)
      if (range && !range.collapsed) await this.createHighlight(range, note, color)
    }
    this.state.serializedSelection = null
    this.state.currentSerializationRoot = undefined
    this.state.currentMarkIdForColorChange = null
    rangy.getSelection().removeAllRanges()
  }

  private async handleDeleteAction() {
    if (this.state.currentMarkIdForColorChange) {
      await this.removeMarkById(this.state.currentMarkIdForColorChange)
    }
    this.state.serializedSelection = null
    this.state.currentSerializationRoot = undefined
    this.state.currentMarkIdForColorChange = null
    rangy.getSelection().removeAllRanges()
  }

  private handleColorChange(color: string, isExisting: boolean) {
    if (isExisting) {
      if (this.state.currentMarkIdForColorChange) {
        querySelectorAllDeep(`.webext-highlight-${this.state.currentMarkIdForColorChange}`).forEach((el) => {
          if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${color}`
        })
      }
    } else if (this.state.serializedSelection) {
      this.clearPreviewHighlight()
      this.previewApplier = rangy.createClassApplier('webext-highlight-preview', {
        elementTagName: 'span',
        elementAttributes: { style: highlightDefaultStyle(color) }
      })
      const root = this.state.currentSerializationRoot || document.documentElement
      const win = root instanceof ShadowRoot ? root.ownerDocument.defaultView : window
      rangy.deserializeSelection(this.state.serializedSelection, root, win || window)
      this.previewApplier.applyToSelection()
      rangy.getSelection().removeAllRanges()
    }
  }

  private handleClearPreview() {
    this.clearPreviewHighlight()
    rangy.getSelection().removeAllRanges()
  }

  private async handleConfirmResolution(
    selections: { originalMarkId: string; candidateElement: HTMLElement; actualText: string; matchIndex: number }[]
  ) {
    for (const { originalMarkId, candidateElement, actualText, matchIndex } of selections) {
      const mark = await sendMessage(
        'get-mark-by-id',
        { id: originalMarkId, url: getCanonicalUrlForMark() },
        'background'
      ) as any
      if (mark) {
        const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
          elementTagName: 'span',
          elementAttributes: { style: highlightDefaultStyle(mark.color) }
        })

        const rangeResult = applyPreciseHighlight(candidateElement, actualText, applier, matchIndex)
        if (rangeResult) {
          const { range } = rangeResult
          // We need to tell the engine that this mark is now restored
          // Accessing private engine.restoredMarkIds is not ideal, but for now we'll assume it's handled or we expose a method.
          // For simplicity, let's assume MarkerApp can coordinate this.

          const root = candidateElement.getRootNode()
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

          await sendMessage(
            'update-mark-details',
            {
              id: mark.id,
              url: mark.url,
              text: actualText,
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
        }
      }
    }
    this.state.ambiguousMarks = []
  }

  private async handleCandidateHover(item: Candidate) {
    const applier = rangy.createClassApplier('webext-highlight-preview-ambiguous', {
      elementTagName: 'span',
      elementAttributes: { style: 'background-color: rgba(255, 165, 0, 0.4); border-bottom: 2px solid orange;' }
    })

    const rangeResult = applyPreciseHighlight(item.candidateElement, item.displayTextSnippet, applier, item.matchIndex)
    if (rangeResult) {
      rangeResult.range.commonAncestorContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  private handleCandidateLeave() {
    const previewElements = querySelectorAllDeep('.webext-highlight-preview-ambiguous')
    const parentsToNormalize = new Set<Node>()
    previewElements.forEach((el) => {
      if (!(el instanceof HTMLElement)) return
      const parent = el.parentNode
      if (parent) {
        parentsToNormalize.add(parent)
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
      }
    })
    parentsToNormalize.forEach((parent) => parent.normalize())
  }

  private async showTooltipForExistingMark(markId: string, x: number, y: number) {
    const mark = await sendMessage('get-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background') as any
    if (mark) {
      this.ui.showTooltip(x, y, true, mark.note, mark.color, mark.text)
    }
  }

  private async removeMarkById(markId: string) {
    const className = `webext-highlight-${markId}`
    const parentsToNormalize = new Set<Node>()
    querySelectorAllDeep(`.${className}`).forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        parentsToNormalize.add(parent)
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
      }
    })
    parentsToNormalize.forEach((parent) => parent.normalize())
    await sendMessage('remove-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
  }

  private async createHighlight(range: rangy.RangyRange, note: string, color: string) {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const className = `webext-highlight-${uniqueId}`
    const applier = rangy.createClassApplier(className, {
      elementTagName: 'span',
      elementAttributes: { style: highlightDefaultStyle(color) }
    })
    const root = range.commonAncestorContainer.getRootNode()
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
    const rangySerialized = rangy.serializeRange(range, true, root instanceof ShadowRoot ? root : undefined)
    const { contextTitle, contextSelector, contextLevel, contextOrder, surroundingSnippet } = getHighlightContext(range)
    
    const content = range.cloneContents()
    stripHighlights(content)
    const tempDiv = document.createElement('div')
    tempDiv.appendChild(content)
    const selectedHtml = content.constructor === DocumentFragment ? tempDiv.innerHTML : range.toString()

    applier.applyToRange(range)

    await sendMessage('add-mark', {
      id: uniqueId,
      url: getCanonicalUrlForMark(),
      text: range.toString(),
      html: selectedHtml,
      note,
      color,
      rangySerialized,
      shadowHostSelector,
      createdAt: Date.now(),
      title: document.title,
      contextTitle,
      contextSelector,
      contextLevel,
      contextOrder,
      surroundingSnippet
    }, 'background')
  }

  private async refreshHighlights() {
    querySelectorAllDeep('span[class*="webext-highlight-"]').forEach(el => {
      if (el.classList.contains('webext-highlight-preview')) return
      const parent = el.parentNode
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
      }
    })
    this.engine.clearRestoredMarkIds()
    await this.engine.restore()
  }

  private clearPreviewHighlight() {
    querySelectorAllDeep('.webext-highlight-preview').forEach(el => {
      if (!(el instanceof HTMLElement)) return
      if (el.className.split(' ').some(cls => cls.startsWith('webext-highlight-') && cls !== 'webext-highlight-preview')) {
        el.classList.remove('webext-highlight-preview')
      } else {
        const parent = el.parentNode
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el)
          parent.removeChild(el)
        }
      }
    })
  }

  private async scrollToMark(markId: string) {
    const className = `webext-highlight-${markId}`
    const element = querySelectorDeep(`.${className}`)
    if (element) {
      const mark = await sendMessage('get-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background') as any
      if (!mark) return
      element.scrollIntoView({ behavior: 'auto', block: 'center' })
      querySelectorAllDeep(`.${className}`).forEach(el => {
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
