import { sendMessage } from 'webext-bridge/content-script'
import { createApp, h, watchEffect } from 'vue'
import browser from 'webextension-polyfill'
import rangy from 'rangy/lib/rangy-core'
import Tooltip from './views/Tooltip.vue'
import DisambiguationModal from './views/DisambiguationModal.vue'
import type { HighlightStateManager } from './state'
import type { Mark } from '~/logic/storage'
import { isDark } from '~/logic/theme'
import { highlightDefaultStyle } from '~/logic/config'
import { settings } from '~/logic/settings'
import {
  DOMScanner,
  applyPreciseHighlight,
  getCanonicalUrlForMark,
  getElementSelector,
  getHighlightContext,
  getMaxZIndex,
  querySelectorAllDeep,
  stripHighlights,
} from '~/logic/dom'
import { ShadowDOMManager } from '~/logic/shadowDom'
import type { Candidate } from '~/logic/search'

export class UIManager {
  private _originalColorForChange: string | null = null
  private _tooltipDebounceTimer: number = 0

  constructor(
    private state: HighlightStateManager,
  ) {}

  ensureMounted(): void {
    // 【样式约定】Shadow DOM 内的视图（Tooltip/DisambiguationModal 等）一律使用 px 任意值
    // （如 p-[12px]、text-[12px]），禁止使用 rem 类（p-3、text-xs）——rem 相对宿主页
    // <html> 的 font-size 计算，会被宿主网站污染；px 绝对单位免疫。见
    // docs/superpowers/specs/2026-08-20-ui-polish-sprint-design.md §1
    const container = document.getElementById(__NAME__)
    if (container) {
      container.style.zIndex = `${getMaxZIndex() + 1}`
      return
    }

    const newContainer = ShadowDOMManager.createContainer(__NAME__, getMaxZIndex() + 1)
    const shadowDOM = newContainer.attachShadow?.({ mode: 'open' }) || newContainer
    ShadowDOMManager.attachStylesheet(shadowDOM as ShadowRoot, browser.runtime.getURL('dist/contentScripts/style.css'))

    const uiRoot = document.createElement('div')
    // 响应式跟随主题设置（手动切换/系统变化时 Shadow DOM 内主题同步）
    watchEffect(() => uiRoot.classList.toggle('dark', isDark.value))
    shadowDOM.appendChild(uiRoot)

    const tooltipRoot = document.createElement('div')
    uiRoot.appendChild(tooltipRoot)
    const tooltipAppInstance = createApp(Tooltip, {
      onSave: (note: string, color: string, tags: string[]) => this.handleSave(note, color, tags),
      onDelete: () => this.handleDelete(),
      onColorChange: (color: string, isExisting: boolean) => this.handleColorChange(color, isExisting),
      onClearPreview: () => this.clearPreviewWithColorRestore(),
    }).mount(tooltipRoot)

    const modalRoot = document.createElement('div')
    uiRoot.appendChild(modalRoot)
    createApp({
      render: () =>
        h(DisambiguationModal, {
          'ambiguousMarksData': this.state.modalState.marks,
          'modelValue': this.state.modalState.visible,
          'onUpdate:modelValue': (val: boolean) => {
            this.state.modalState.visible = val
          },
          'onConfirmResolution': (selections: any) => this.handleConfirmResolution(selections),
          'onDiscardMark': (markId: string) => this.handleDiscardMark(markId),
          'onCancel': () => {
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
      if (!(el instanceof HTMLElement))
        return
      const parent = el.parentNode
      if (parent) {
        parentsToNormalize.add(parent)
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
      }
    })
    parentsToNormalize.forEach(parent => parent.normalize())
  }

  private async handleDiscardMark(markId: string) {
    // eslint-disable-next-line no-alert
    if (confirm('确定要彻底丢弃此标记吗？')) {
      await this.removeMarkById(markId)
      this.state.modalState.marks = this.state.modalState.marks.filter(m => m.originalMarkId !== markId)
      if (this.state.modalState.marks.length === 0)
        this.state.modalState.visible = false
    }
  }

  private async handleConfirmResolution(
    selections: { originalMarkId: string, candidateElement: HTMLElement, actualText: string, matchIndex: number }[],
  ) {
    for (const { originalMarkId, candidateElement, actualText, matchIndex } of selections) {
      const mark = await sendMessage('get-mark-by-id', { id: originalMarkId, url: getCanonicalUrlForMark() }, 'background')
      if (mark) {
        const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
          elementTagName: 'span',
          elementAttributes: { style: highlightDefaultStyle(mark.color, settings.value.highlightHeight) },
        })

        const rangeResult = applyPreciseHighlight(candidateElement, actualText, applier, matchIndex)
        if (rangeResult) {
          const { range } = rangeResult
          this.state.restoredMarkIds.add(mark.id)

          const root = candidateElement.getRootNode()
          const newSerialized = rangy.serializeRange(range, true, root instanceof ShadowRoot ? root : undefined)
          const { contextTitle, contextSelector, contextLevel, contextOrder, surroundingSnippet } = getHighlightContext(range)
          const domIndex = DOMScanner.calculatePreciseOffset(range, root instanceof ShadowRoot ? root : document.body)

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
              domIndex,
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
      m => !this.state.restoredMarkIds.has(m.originalMarkId),
    )
  }

  private handleColorChange(color: string, isExisting: boolean) {
    if (isExisting) {
      if (this.state.currentMarkIdForColorChange) {
        querySelectorAllDeep(`.webext-highlight-${this.state.currentMarkIdForColorChange}`).forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.boxShadow = `inset 0 -${settings.value.highlightHeight}px 0 0 ${color}`
            el.style.paddingBottom = `${settings.value.highlightHeight}px`
          }
        })
      }
    }
    else {
      if (this.state.serializedSelection) {
        this.clearPreviewHighlight()
        this.state.previewApplier = rangy.createClassApplier('webext-highlight-preview', {
          elementTagName: 'span',
          elementAttributes: { style: `${highlightDefaultStyle(color, settings.value.highlightHeight)}` },
        })
        try {
          const root = this.state.currentSerializationRoot || document.documentElement
          const win = root instanceof ShadowRoot ? root.ownerDocument.defaultView : window
          rangy.deserializeSelection(this.state.serializedSelection, root, win || window)
          this.state.previewApplier.applyToSelection()
        }
        catch (_e) {
          console.error('应用预览高亮失败:', _e)
        }
        finally {
          rangy.getSelection().removeAllRanges()
        }
      }
    }
  }

  clearPreviewWithColorRestore(): void {
    if (this.state.currentMarkIdForColorChange && this._originalColorForChange) {
      querySelectorAllDeep(`.webext-highlight-${this.state.currentMarkIdForColorChange}`).forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.boxShadow = `inset 0 -${settings.value.highlightHeight}px 0 0 ${this._originalColorForChange}`
          el.style.paddingBottom = `${settings.value.highlightHeight}px`
        }
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
      if (!(el instanceof HTMLElement))
        return
      if (
        el.className.split(' ').some(cls => cls.startsWith('webext-highlight-') && cls !== 'webext-highlight-preview')
      ) {
        el.classList.remove('webext-highlight-preview')
      }
      else {
        const parent = el.parentNode
        if (parent) {
          parentsToNormalize.add(parent)
          while (el.firstChild) parent.insertBefore(el.firstChild, el)
          parent.removeChild(el)
        }
      }
    })
    parentsToNormalize.forEach(parent => parent.normalize())
  }

  showTooltip(anchorRect: DOMRect, isHighlighted: boolean, note: string, color: string, text: string, tags: string[] = [], pointer?: { x: number, y: number }): void {
    clearTimeout(this._tooltipDebounceTimer)
    this._tooltipDebounceTimer = window.setTimeout(() => {
      this.ensureMounted()
      this.state.tooltipApp?.show(anchorRect, isHighlighted, note, color, text, tags, pointer)
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

  private async handleSave(note: string, color: string, tags: string[] = []) {
    if (this.state.currentMarkIdForColorChange) {
      try {
        await sendMessage(
          'update-mark-details',
          { id: this.state.currentMarkIdForColorChange, url: getCanonicalUrlForMark(), note, color, tags },
          'background',
        )
        document.querySelectorAll(`.webext-highlight-${this.state.currentMarkIdForColorChange}`).forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.boxShadow = `inset 0 -${settings.value.highlightHeight}px 0 0 ${color}`
            el.style.paddingBottom = `${settings.value.highlightHeight}px`
          }
        })
      }
      catch (e) {
        console.error('Error during mark update:', e)
      }
    }
    else {
      this.clearPreviewHighlight()
      if (!this.state.serializedSelection)
        return
      try {
        const root = this.state.currentSerializationRoot || document.documentElement
        const doc = root instanceof ShadowRoot ? root.ownerDocument : document
        const range = rangy.deserializeRange(this.state.serializedSelection, root, doc)
        if (range && !range.collapsed)
          await this.createHighlight(range, note, color, tags)
      }
      catch (e) {
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
    if (!this.state.serializedSelection)
      return
    try {
      if (this.state.currentMarkIdForColorChange)
        await this.removeMarkById(this.state.currentMarkIdForColorChange)
    }
    catch (e) {
      console.error('Error during delete action:', e)
    }
    finally {
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
    parentsToNormalize.forEach(parent => parent.normalize())
    await sendMessage('remove-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
  }

  private async createHighlight(
    rangyRange: rangy.RangyRange,
    note?: string,
    color: string = settings.value.defaultHighlightColor,
    manualTags: string[] = [],
  ) {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const className = `webext-highlight-${uniqueId}`
    const applier = rangy.createClassApplier(className, {
      elementTagName: 'span',
      elementAttributes: { style: highlightDefaultStyle(color, settings.value.highlightHeight) },
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

    // 计算物理位置索引
    const container = (root instanceof ShadowRoot) ? root : document.body
    const domIndex = DOMScanner.calculatePreciseOffset(rangyRange, container)

    const content = rangyRange.cloneContents()
    stripHighlights(content)
    const tempDiv = document.createElement('div')
    tempDiv.appendChild(content)
    const selectedHtml = tempDiv.innerHTML
    applier.applyToRange(rangyRange)
    this.state.restoredMarkIds.add(uniqueId) // 标记为已恢复，防止 restorer 重复处理触发歧义

    // 仅使用手动选择的标签
    const tags: string[] = [...manualTags]

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
      domIndex,
      tags,
      contextTitle,
      contextSelector,
      contextLevel,
      contextOrder,
      surroundingSnippet,
    }
    await sendMessage('add-mark', markData, 'background')
    // 记录本次新建标记选中的标签（含空集合），供下次新建时预选。仅新建分支，编辑分支不更新。
    settings.value.lastUsedTags = [...tags]
  }
}
