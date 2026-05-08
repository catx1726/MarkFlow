import { sendMessage } from 'webext-bridge/content-script'
import { createApp, h } from 'vue'
import browser from 'webextension-polyfill'
import rangy from 'rangy/lib/rangy-core'
import Tooltip from './views/Tooltip.vue'
import DisambiguationModal from './views/DisambiguationModal.vue'
import type { Mark } from '~/logic/storage'
import { highlightDefaultStyle } from '~/logic/config'
import { settings } from '~/logic/settings'
import {
  applyPreciseHighlight,
  getCanonicalUrlForMark,
  getHighlightContext,
  getElementSelector,
  querySelectorAllDeep,
  stripHighlights,
  getMaxZIndex,
} from '~/logic/dom'
import { ShadowDOMManager } from '~/logic/shadowDom'
import type { Candidate } from '~/logic/search'
import type { HighlightStateManager } from './state'

export class UIManager {
  private _originalColorForChange: string | null = null
  private _tooltipDebounceTimer: number = 0

  constructor(
    private state: HighlightStateManager,
  ) {}

  ensureMounted(): void {
    const container = document.getElementById(__NAME__)
    if (container) {
      container.style.zIndex = `${getMaxZIndex() + 1}`
      return
    }

    const newContainer = ShadowDOMManager.createContainer(__NAME__, getMaxZIndex() + 1)
    const shadowDOM = newContainer.attachShadow?.({ mode: 'open' }) || newContainer
    ShadowDOMManager.attachStylesheet(shadowDOM as ShadowRoot, browser.runtime.getURL('dist/contentScripts/style.css'))

    const uiRoot = document.createElement('div')
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) uiRoot.classList.add('dark')
    shadowDOM.appendChild(uiRoot)

    const tooltipRoot = document.createElement('div')
    uiRoot.appendChild(tooltipRoot)
    const tooltipAppInstance = createApp(Tooltip, {
      onSave: (note: string, color: string) => this.handleSave(note, color),
      onDelete: () => this.handleDelete(),
      onColorChange: (color: string, isExisting: boolean) => this.handleColorChange(color, isExisting),
      onClearPreview: () => this.clearPreviewWithColorRestore(),
    }).mount(tooltipRoot)

    const modalRoot = document.createElement('div')
    uiRoot.appendChild(modalRoot)
    createApp({
      render: () =>
        h(DisambiguationModal, {
          ambiguousMarksData: this.state.modalState.marks,
          modelValue: this.state.modalState.visible,
          'onUpdate:modelValue': (val: boolean) => {
            this.state.modalState.visible = val
          },
          onConfirmResolution: (selections: any) => this.handleConfirmResolution(selections),
          onDiscardMark: (markId: string) => this.handleDiscardMark(markId),
          onCancel: () => {
            this.state.modalState.visible = false
          },
          'onHover-list-item': (item: Candidate) => this.handleCandidateHover(item),
          'onLeave-list-item': () => this.handleCandidateLeave(),
        }),
    }).mount(modalRoot)

    document.body.appendChild(newContainer)

    this.state.tooltipApp = tooltipAppInstance as any
    this.state.disambiguationModalApp = {
      show: (marks: Candidate[]) => {
        this.state.modalState.marks = marks
        this.state.modalState.visible = true
      },
      hide: () => {
        this.state.modalState.visible = false
      },
    }
  }

  private async handleCandidateHover(item: Candidate) {
    const applier = rangy.createClassApplier('webext-highlight-preview-ambiguous', {
      elementTagName: 'span',
      elementAttributes: { style: 'background-color: rgba(255, 165, 0, 0.4); border-bottom: 2px solid orange;' },
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

  private async handleDiscardMark(markId: string) {
    if (confirm('确定要彻底丢弃此标记吗？')) {
      await this.removeMarkById(markId)
      this.state.modalState.marks = this.state.modalState.marks.filter((m) => m.originalMarkId !== markId)
      if (this.state.modalState.marks.length === 0) this.state.modalState.visible = false
    }
  }

  private async handleConfirmResolution(
    selections: { originalMarkId: string; candidateElement: HTMLElement; actualText: string; matchIndex: number }[],
  ) {
    for (const { originalMarkId, candidateElement, actualText, matchIndex } of selections) {
      const mark = await sendMessage('get-mark-by-id', { id: originalMarkId, url: getCanonicalUrlForMark() }, 'background')
      if (mark) {
        const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
          elementTagName: 'span',
          elementAttributes: { style: highlightDefaultStyle(mark.color) },
        })

        const rangeResult = applyPreciseHighlight(candidateElement, actualText, applier, matchIndex)
        if (rangeResult) {
          const { range } = rangeResult
          this.state.restoredMarkIds.add(mark.id)

          const root = candidateElement.getRootNode()
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
              surroundingSnippet,
            } as any,
            'background',
          )
        }
      }
    }
    this.state.ambiguousMarksQueue.value = this.state.ambiguousMarksQueue.value.filter(
      (m) => !this.state.restoredMarkIds.has(m.originalMarkId),
    )
  }

  private handleColorChange(color: string, isExisting: boolean) {
    if (isExisting) {
      if (this.state.currentMarkIdForColorChange) {
        querySelectorAllDeep(`.webext-highlight-${this.state.currentMarkIdForColorChange}`).forEach((el) => {
          if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${color}`
        })
      }
    } else {
      if (this.state.serializedSelection) {
        this.clearPreviewHighlight()
        this.state.previewApplier = rangy.createClassApplier('webext-highlight-preview', {
          elementTagName: 'span',
          elementAttributes: { style: `${highlightDefaultStyle(color)}` },
        })
        try {
          const root = this.state.currentSerializationRoot || document.documentElement
          const win = root instanceof ShadowRoot ? root.ownerDocument.defaultView : window
          rangy.deserializeSelection(this.state.serializedSelection, root, win || window)
          this.state.previewApplier.applyToSelection()
        } catch (_e) {
          console.error('应用预览高亮失败:', _e)
        } finally {
          rangy.getSelection().removeAllRanges()
        }
      }
    }
  }

  clearPreviewWithColorRestore(): void {
    if (this.state.currentMarkIdForColorChange && this._originalColorForChange) {
      querySelectorAllDeep(`.webext-highlight-${this.state.currentMarkIdForColorChange}`).forEach((el) => {
        if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${this._originalColorForChange}`
      })
    }
    this.clearPreviewHighlight()
    rangy.getSelection().removeAllRanges()
    this._originalColorForChange = null
  }

  clearPreviewHighlight(): void {
    const previewElements = querySelectorAllDeep('.webext-highlight-preview')
    const parentsToNormalize = new Set<Node>()
    previewElements.forEach((el) => {
      if (!(el instanceof HTMLElement)) return
      if (
        el.className.split(' ').some((cls) => cls.startsWith('webext-highlight-') && cls !== 'webext-highlight-preview')
      ) {
        el.classList.remove('webext-highlight-preview')
      } else {
        const parent = el.parentNode
        if (parent) {
          parentsToNormalize.add(parent)
          while (el.firstChild) parent.insertBefore(el.firstChild, el)
          parent.removeChild(el)
        }
      }
    })
    parentsToNormalize.forEach((parent) => parent.normalize())
  }

  showTooltip(x: number, y: number, isHighlighted: boolean, note: string, color: string, text: string): void {
    clearTimeout(this._tooltipDebounceTimer)
    this._tooltipDebounceTimer = window.setTimeout(() => {
      this.ensureMounted()
      this.state.tooltipApp?.show(x, y, isHighlighted, note, color, text)
    }, 50)
  }

  hideTooltip(): void {
    this.state.tooltipApp?.hide()
  }

  cancelTooltipDebounce(): void {
    clearTimeout(this._tooltipDebounceTimer)
  }

  setOriginalColorForChange(color: string | null): void {
    this._originalColorForChange = color
  }

  private async handleSave(note: string, color: string) {
    if (this.state.currentMarkIdForColorChange) {
      try {
        await sendMessage(
          'update-mark-details',
          { id: this.state.currentMarkIdForColorChange, url: getCanonicalUrlForMark(), note, color },
          'background',
        )
        document.querySelectorAll(`.webext-highlight-${this.state.currentMarkIdForColorChange}`).forEach((el) => {
          if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${color}`
        })
      } catch (e) {
        console.error('Error during mark update:', e)
      }
    } else {
      this.clearPreviewHighlight()
      if (!this.state.serializedSelection) return
      try {
        const root = this.state.currentSerializationRoot || document.documentElement
        const doc = root instanceof ShadowRoot ? root.ownerDocument : document
        const range = rangy.deserializeRange(this.state.serializedSelection, root, doc)
        if (range && !range.collapsed) await this.createHighlight(range, note, color)
      } catch (e) {
        console.error('Error during save action (create):', e)
      }
    }
    this.state.currentSerializationRoot = undefined
    this.state.serializedSelection = null
    this.state.currentMarkIdForColorChange = null
    this._originalColorForChange = null
    rangy.getSelection().removeAllRanges()
  }

  private async handleDelete() {
    if (!this.state.serializedSelection) return
    try {
      if (this.state.currentMarkIdForColorChange) await this.removeMarkById(this.state.currentMarkIdForColorChange)
    } catch (e) {
      console.error('Error during delete action:', e)
    } finally {
      this.state.currentSerializationRoot = undefined
      this.state.serializedSelection = null
      this.state.currentMarkIdForColorChange = null
      this._originalColorForChange = null
      rangy.getSelection().removeAllRanges()
    }
  }

  async removeMarkById(markId: string): Promise<void> {
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

  private async createHighlight(
    rangyRange: rangy.RangyRange,
    note?: string,
    color: string = settings.value.defaultHighlightColor,
  ) {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const className = `webext-highlight-${uniqueId}`
    const applier = rangy.createClassApplier(className, {
      elementTagName: 'span',
      elementAttributes: { style: highlightDefaultStyle(color) },
    })
    const root = rangyRange.commonAncestorContainer.getRootNode()
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
    const rangySerialized = rangy.serializeRange(rangyRange, true, root instanceof ShadowRoot ? root : undefined)
    const selectedText = rangyRange.toString()
    const { contextTitle, contextSelector, contextLevel, contextOrder, surroundingSnippet } = getHighlightContext(rangyRange)
    const content = rangyRange.cloneContents()
    stripHighlights(content)
    const tempDiv = document.createElement('div')
    tempDiv.appendChild(content)
    const selectedHtml = tempDiv.innerHTML
    applier.applyToRange(rangyRange)
    const markData: Mark = {
      id: uniqueId,
      url: getCanonicalUrlForMark(),
      text: selectedText,
      html: selectedHtml,
      note: note || '',
      color,
      rangySerialized,
      shadowHostSelector,
      createdAt: Date.now(),
      title: document.title,
      contextTitle,
      contextSelector,
      contextLevel,
      contextOrder,
      surroundingSnippet,
    }
    await sendMessage('add-mark', markData, 'background')
  }
}
