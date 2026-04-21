/**
 * # 标记应用主逻辑 (Marker App)
 * 
 * 本模块是 Content Script 的核心总控室。
 * 核心架构：**Manager-Service 协作模型 (Orchestration Pattern)**。
 * 
 * 职责：
 * 1. 初始化并协调各子系统（UIPortal, InteractionController, RestorationEngine）。
 * 2. 维护全局共享状态 (AppState)。
 * 3. 监听并分发来自 Background 的扩展消息。
 */

import { onMessage, sendMessage } from 'webext-bridge/content-script'
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-serializer'
import 'rangy/lib/rangy-classapplier'
import {
  getCanonicalUrlForMark,
  querySelectorDeep,
  querySelectorAllDeep,
  getHighlightContext,
  stripHighlights,
  getElementSelector,
  Highlighter
} from '~/logic/dom'
import { highlightDefaultStyle } from '~/logic/config'
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
    // 1. 初始化 UI 门户
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

    // 2. 初始化交互控制器
    this.interaction = new InteractionController(this.state, this.ui, {
      clearPreviewHighlight: this.clearPreviewHighlight.bind(this),
      showTooltipForSelection: (x, y, textToCopy) => 
        this.ui.showTooltip(x, y, false, '', settings.value.defaultHighlightColor, textToCopy),
      showTooltipForExistingMark: this.showTooltipForExistingMark.bind(this),
      applyPreviewHighlight: (range) => this.previewApplier?.applyToRange(range)
    })

    // 3. 初始化恢复引擎
    this.engine = new RestorationEngine(this.state, {
      onAmbiguity: (marks) => this.ui.showDisambiguation(marks)
    })
  }

  /**
   * 应用启动引导
   */
  async init() {
    console.log('[MarkerApp] Bootstrapping...')
    
    // 等待配置加载
    await settingsReady
    this.state.settings = settings.value
    
    // 黑名单检查
    if (isPageBlacklisted(window.location.href, settings.value.blacklist)) {
      console.log('[MarkerApp] Current page is blacklisted, skipping init.')
      return
    }

    // 初始化 Rangy 核心
    rangy.init()
    this.initializePreviewApplier()

    // 启动各子系统
    this.ui.mount()
    this.interaction.setupListeners()
    this.engine.setupObserver()

    // 注册跨进程消息监听
    this.setupMessageListeners()
    
    // 执行初始加载动作 (自动恢复 & Hash 跳转)
    await this.handleInitialLoadActions()
    
    console.log('[MarkerApp] System ready.')
  }

  /**
   * 初始化预览高亮器 (用于用户选区时的实时视觉反馈)
   */
  private initializePreviewApplier() {
    this.previewApplier = rangy.createClassApplier('webext-highlight-preview', {
      elementTagName: 'span',
      elementAttributes: { style: highlightDefaultStyle(settings.value.defaultHighlightColor) },
      normalize: false
    })
  }

  /**
   * 注册来自 Background 或其他页面的消息回调
   */
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
      if (element instanceof HTMLElement) {
        this.highlightAndScrollToElement(element)
      }
    })
  }

  /**
   * 处理页面首次加载时的逻辑
   */
  private async handleInitialLoadActions() {
    // 1. 恢复已有标记
    await this.engine.restore()
    
    // 2. 处理 URL Hash 跳转
    const currentHash = window.location.hash
    if (currentHash.startsWith('#__highlight-mark__')) {
      const targetMarkId = currentHash.substring('#__highlight-mark__'.length)
      if (targetMarkId) {
        setTimeout(() => this.scrollToMark(targetMarkId), 100)
      }
    }
  }

  /**
   * 路由函数：根据状态决定是“创建新高亮”还是“更新旧标记”
   */
  private async handleSaveAction(note: string, color: string) {
    if (this.state.currentMarkIdForColorChange) {
      await this.updateExistingMark(this.state.currentMarkIdForColorChange, note, color)
    } else {
      await this.createNewHighlightFromSelection(note, color)
    }
    
    this.resetSelectionState()
    rangy.getSelection().removeAllRanges()
  }

  /**
   * 更新已有标记的备注与颜色
   */
  private async updateExistingMark(markId: string, note: string, color: string) {
    await sendMessage('update-mark-details', {
      id: markId,
      url: getCanonicalUrlForMark(),
      note,
      color
    }, 'background')
    
    this.updateMarkVisuals(markId, color)
  }

  /**
   * 更新页面上对应标记的视觉样式 (通过 boxShadow)
   */
  private updateMarkVisuals(markId: string, color: string) {
    const highlightElements = querySelectorAllDeep(`.webext-highlight-${markId}`)
    highlightElements.forEach((element) => {
      if (element instanceof HTMLElement) {
        element.style.boxShadow = `inset 0 -5px 0 0 ${color}`
      }
    })
  }

  /**
   * 基于当前用户选区创建新高亮
   */
  private async createNewHighlightFromSelection(note: string, color: string) {
    this.clearPreviewHighlight()
    if (!this.state.serializedSelection) return
    
    const root = this.state.currentSerializationRoot || document.documentElement
    const doc = root instanceof ShadowRoot ? root.ownerDocument : document
    const range = (rangy as any).deserializeRange(this.state.serializedSelection, root, doc)
    
    if (range && !range.collapsed) {
      await this.persistNewHighlight(range, note, color)
    }
  }

  /**
   * 选区状态归零
   */
  private resetSelectionState() {
    this.state.serializedSelection = null
    this.state.currentSerializationRoot = undefined
    this.state.currentMarkIdForColorChange = null
  }

  /**
   * 处理删除动作
   */
  private async handleDeleteAction() {
    if (this.state.currentMarkIdForColorChange) {
      await this.removeMarkById(this.state.currentMarkIdForColorChange)
    }
    this.resetSelectionState()
    rangy.getSelection().removeAllRanges()
  }

  /**
   * 处理颜色面板变化：实时更新页面反馈
   */
  private handleColorChange(color: string, isExistingMark: boolean) {
    if (isExistingMark) {
      this.updateMarkVisuals(this.state.currentMarkIdForColorChange!, color)
    } else {
      this.previewColorOnNewSelection(color)
    }
  }

  /**
   * 在新选区上实时预览高亮颜色
   */
  private previewColorOnNewSelection(color: string) {
    if (!this.state.serializedSelection) return
    
    this.clearPreviewHighlight()
    this.previewApplier = rangy.createClassApplier('webext-highlight-preview', {
      elementTagName: 'span',
      elementAttributes: { style: highlightDefaultStyle(color) }
    })
    
    const root = this.state.currentSerializationRoot || document.documentElement
    const win = (root instanceof ShadowRoot) ? root.ownerDocument.defaultView : window
    ;(rangy as any).deserializeSelection(this.state.serializedSelection, root, win || window)
    this.previewApplier.applyToSelection()
    rangy.getSelection().removeAllRanges()
  }

  private handleClearPreview() {
    this.clearPreviewHighlight()
    rangy.getSelection().removeAllRanges()
  }

  /**
   * 批量确认歧义修复结果
   */
  private async handleConfirmResolution(
    selections: { originalMarkId: string; candidateElement: HTMLElement; actualText: string; matchIndex: number }[]
  ) {
    for (const selection of selections) {
      const mark = await sendMessage('get-mark-by-id', { id: selection.originalMarkId, url: getCanonicalUrlForMark() }, 'background') as any
      if (!mark) continue

      const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
        elementTagName: 'span',
        elementAttributes: { style: highlightDefaultStyle(mark.color) }
      })

      const rangeResult = Highlighter.applyPreciseHighlight(selection.candidateElement, selection.actualText, applier, selection.matchIndex)
      if (rangeResult) {
        await this.syncRelocatedMarkToDatabase(mark, rangeResult.range, selection.actualText, selection.candidateElement)
      }
    }
    this.state.ambiguousMarks = []
  }

  /**
   * 位置修复后，将新的元数据与路径同步至 Background 数据库
   */
  private async syncRelocatedMarkToDatabase(mark: any, range: rangy.RangyRange, actualText: string, candidateElement: HTMLElement) {
    const root = candidateElement.getRootNode()
    const newSerialized = (rangy as any).serializeRange(range, true, root instanceof ShadowRoot ? root : undefined)
    const context = getHighlightContext(range)

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

    const contentFragment = range.cloneContents()
    stripHighlights(contentFragment)
    const tempDiv = document.createElement('div')
    tempDiv.appendChild(contentFragment)
    const actualHtml = contentFragment.constructor === DocumentFragment ? tempDiv.innerHTML : range.toString()

    await sendMessage('update-mark-details', {
      id: mark.id,
      url: mark.url,
      text: actualText,
      html: actualHtml,
      rangySerialized: newSerialized,
      shadowHostSelector: shadowHostSelector || null,
      ...context
    } as any, 'background')
  }

  private async handleDiscardMark(markId: string) {
    if (confirm('确定要彻底丢弃此标记吗？')) {
      await this.removeMarkById(markId)
      this.state.ambiguousMarks = this.state.ambiguousMarks.filter(m => m.originalMarkId !== markId)
    }
  }

  private async handleCandidateHover(item: Candidate) {
    const applier = rangy.createClassApplier('webext-highlight-preview-ambiguous', {
      elementTagName: 'span',
      elementAttributes: { style: 'background-color: rgba(255, 165, 0, 0.4); border-bottom: 2px solid orange;' }
    })

    const rangeResult = Highlighter.applyPreciseHighlight(item.candidateElement, item.displayTextSnippet, applier, item.matchIndex)
    if (rangeResult) {
      rangeResult.range.commonAncestorContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  private handleCandidateLeave() {
    const previewElements = querySelectorAllDeep('.webext-highlight-preview-ambiguous')
    const parentsToNormalize = new Set<Node>()
    previewElements.forEach((element) => {
      if (!(element instanceof HTMLElement)) return
      const parent = element.parentNode
      if (parent) {
        parentsToNormalize.add(parent)
        while (element.firstChild) parent.insertBefore(element.firstChild, element)
        parent.removeChild(element)
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

  /**
   * 彻底移除一个标记：物理删除 DOM 节点 + 数据库记录
   */
  private async removeMarkById(markId: string) {
    const className = `webext-highlight-${markId}`
    const parentsToNormalize = new Set<Node>()
    
    querySelectorAllDeep(`.${className}`).forEach((element) => {
      const parent = element.parentNode
      if (parent) {
        parentsToNormalize.add(parent)
        while (element.firstChild) parent.insertBefore(element.firstChild, element)
        parent.removeChild(element)
      }
    })
    parentsToNormalize.forEach((parent) => parent.normalize())
    
    await sendMessage('remove-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
  }

  /**
   * 将新创建的 Range 持久化到数据库
   */
  private async persistNewHighlight(range: rangy.RangyRange, note: string, color: string) {
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
      let currentRootNode: Node = root
      while (currentRootNode instanceof ShadowRoot) {
        chain.unshift(getElementSelector(currentRootNode.host))
        currentRootNode = currentRootNode.host.getRootNode()
      }
      shadowHostSelector = chain.join('|>>>|')
    }
    
    const rangySerialized = (rangy as any).serializeRange(range, true, root instanceof ShadowRoot ? root : undefined)
    const context = getHighlightContext(range)
    
    const contentFragment = range.cloneContents()
    stripHighlights(contentFragment)
    const tempDiv = document.createElement('div')
    tempDiv.appendChild(contentFragment)
    const selectedHtml = contentFragment.constructor === DocumentFragment ? tempDiv.innerHTML : range.toString()

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
      ...context
    }, 'background')
  }

  /**
   * 全量重新刷新页面上的标记 (清除 DOM 缓存并触发 Engine.restore)
   */
  private async refreshHighlights() {
    querySelectorAllDeep('span[class*="webext-highlight-"]').forEach(element => {
      if (element.classList.contains('webext-highlight-preview')) return
      const parent = element.parentNode
      if (parent) {
        while (element.firstChild) parent.insertBefore(element.firstChild, element)
        parent.removeChild(element)
      }
    })
    this.engine.clearRestoredMarkIds()
    await this.engine.restore()
  }

  /**
   * 仅清理预览状态的高亮标签
   */
  private clearPreviewHighlight() {
    querySelectorAllDeep('.webext-highlight-preview').forEach(element => {
      if (!(element instanceof HTMLElement)) return
      // 如果该节点同时包含正式标记类，仅移除预览类
      if (element.className.split(' ').some(cls => cls.startsWith('webext-highlight-') && cls !== 'webext-highlight-preview')) {
        element.classList.remove('webext-highlight-preview')
      } else {
        const parent = element.parentNode
        if (parent) {
          while (element.firstChild) parent.insertBefore(element.firstChild, element)
          parent.removeChild(element)
        }
      }
    })
  }

  /**
   * 滚动至特定标记位置，并显示短暂的高亮闪烁动画
   */
  private async scrollToMark(markId: string) {
    const className = `webext-highlight-${markId}`
    const element = querySelectorDeep(`.${className}`)
    if (element instanceof HTMLElement) {
      const mark = await sendMessage('get-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background') as any
      if (!mark) return
      
      element.scrollIntoView({ behavior: 'auto', block: 'center' })
      this.playFlashAnimation(markId, mark.color)
    }
  }

  private playFlashAnimation(markId: string, originalColor: string) {
    querySelectorAllDeep(`.webext-highlight-${markId}`).forEach(element => {
      if (!(element instanceof HTMLElement)) return
      element.style.transition = 'box-shadow 0.5s ease-in-out'
      // 闪烁颜色 (取颜色组中的辅助色)
      element.style.boxShadow = `inset 0 -5px 0 0 ${settings.value.highlightColors[1]}`
      setTimeout(() => {
        element.style.boxShadow = `inset 0 -5px 0 0 ${originalColor}`
      }, 1000)
    })
  }

  private highlightAndScrollToElement(element: HTMLElement) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.style.transition = 'outline 0.1s ease-in-out'
    element.style.outline = '3px solid #3B82F6'
    setTimeout(() => {
      element.style.outline = ''
    }, 1500)
  }
}
