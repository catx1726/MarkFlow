/**
 * # 交互控制器 (Interaction Controller)
 * 
 * 本模块负责管理所有用户输入的 DOM 事件监听与选区处理。
 * 核心设计原则：**跨 Shadow DOM 的事件委托 (Cross-Shadow Event Delegation)**。
 * 
 * 通过捕获阶段监听，穿透多层 Shadow DOM，实现统一的选区生命周期管理。
 */

import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-serializer'
import type { AppState, IInteractionController, IUIPortal } from './types'
import {
  getMarkIdFromElement,
  querySelectorAllDeep
} from '~/logic/dom'

/**
 * 交互控制器所需的操作接口
 */
export interface InteractionActions {
  clearPreviewHighlight: () => void
  showTooltipForSelection: (x: number, y: number, textToCopy: string) => void
  showTooltipForExistingMark: (markId: string, x: number, y: number) => Promise<void>
  applyPreviewHighlight: (range: rangy.RangyRange) => void
}

export class InteractionController implements IInteractionController {
  private selectionTimer: number | undefined

  constructor(
    private state: AppState,
    private ui: IUIPortal,
    private actions: InteractionActions
  ) {}

  /**
   * 初始化事件监听器
   */
  setupListeners() {
    this.attachListenersToShadowRoots(document)
  }

  /**
   * 递归为 document 和所有 Shadow Root 附加监听器
   * 采用捕获阶段 (true) 以确保 Shadow DOM 内事件可被捕获
   */
  private attachListenersToShadowRoots(rootNode: Document | ShadowRoot) {
    try {
      if (!rootNode) return
      
      rootNode.addEventListener('mousedown', ((event: MouseEvent) => this.handleMouseDown(event)) as EventListener, true)
      rootNode.addEventListener('mouseup', ((event: MouseEvent) => this.handleMouseUp(event)) as EventListener, true)
      
      const allElements = rootNode.querySelectorAll('*')
      for (const element of Array.from(allElements)) {
        if (element.shadowRoot) {
          this.attachListenersToShadowRoots(element.shadowRoot)
        }
      }
    } catch (error) {
      console.error('[InteractionController] Failed to attach shadow listeners:', error)
    }
  }

  /**
   * 处理鼠标按下：清理当前预览和 UI
   */
  private handleMouseDown(event: MouseEvent) {
    const composedPath = event.composedPath() as HTMLElement[]
    const actualTarget = composedPath[0]
    
    if (!actualTarget) return

    // 忽略 Shadow Host 点击，由 Shadow Root 内的监听器处理具体逻辑
    if (actualTarget.shadowRoot && event.currentTarget === document) return
    
    // 忽略输入框点击
    if (this.isInputElement(actualTarget)) return
    
    // 忽略点击扩展自身 UI (Tooltip)
    if (composedPath.some((element) => element instanceof HTMLElement && element.classList.contains('tooltip-card'))) return

    // 如果点击非高亮区域，隐藏 Tooltip 并清理预览
    if (!actualTarget.closest('span[class*="webext-highlight-"]')) {
      this.ui.hideTooltip()
      this.actions.clearPreviewHighlight()
    }
  }

  /**
   * 处理鼠标抬起：触发选区分析逻辑
   */
  private handleMouseUp(event: MouseEvent) {
    const composedPath = event.composedPath() as HTMLElement[]
    const actualTarget = composedPath[0]

    if (!actualTarget || this.isInputElement(actualTarget)) return
    
    // 忽略右键点击或点击 UI 内部
    if (event.button === 2 || composedPath.some((element) => element instanceof HTMLElement && element.classList.contains('tooltip-card')))
      return

    const eventSnapshot = {
      target: actualTarget,
      path: composedPath,
      clientX: event.clientX,
      clientY: event.clientY,
      altKey: event.altKey,
      detail: event.detail
    }

    // 使用 debounce 确保选区稳定后再处理
    clearTimeout(this.selectionTimer)
    this.selectionTimer = window.setTimeout(() => this.processSelection(eventSnapshot), 50) as any
  }

  /**
   * 判断元素是否为输入控件
   */
  private isInputElement(element: HTMLElement): boolean {
    return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable
  }

  /**
   * 核心逻辑：分析当前选区状态并分发操作
   */
  private processSelection(event: {
    target: EventTarget | null
    path: EventTarget[]
    clientX: number
    clientY: number
    altKey: boolean
    detail: number
  }) {
    const initialSelection = rangy.getSelection()
    const targetNode = event.target as Node
    const targetElement = (
      targetNode.nodeType === Node.ELEMENT_NODE ? targetNode : targetNode.parentNode
    ) as HTMLElement | null
    
    const markElement = targetElement?.closest('span[class*="webext-highlight-"]') as HTMLElement | null
    const isCreatingNewMark = event.altKey && !initialSelection.isCollapsed

    // 1. 处理新标记创建逻辑 (Alt + 选择)
    if (isCreatingNewMark) {
      this.handleNewSelection(event)
      return
    }

    // 2. 处理点击已有标记逻辑
    if (markElement && initialSelection.isCollapsed) {
      if (markElement.classList.contains('webext-highlight-preview')) return
      this.handleExistingMarkClick(markElement, event.clientX, event.clientY)
      return
    }

    // 3. 兜底：隐藏 UI 并清理状态
    this.ui.hideTooltip()
    this.state.currentMarkIdForColorChange = null
    this.state.serializedSelection = null
    this.state.currentSerializationRoot = undefined
  }

  /**
   * 处理新的用户选区
   */
  private handleNewSelection(event: any) {
    this.actions.clearPreviewHighlight()
    let range: rangy.RangyRange | null = null

    // 三击 (Detail >= 3) 穿透 Shadow DOM 选择整段块
    if (event.detail >= 3) {
      range = this.selectBlockFromClick(event)
    }

    if (!range) {
      const freshSelection = rangy.getSelection()
      if (freshSelection.rangeCount > 0 && !freshSelection.isCollapsed) range = freshSelection.getRangeAt(0)
    }

    if (range && !range.collapsed) {
      const capturedText = range.toString().trim()
      if (!capturedText) return
      
      try {
        const root = range.commonAncestorContainer.getRootNode()
        const capturedRoot = root instanceof ShadowRoot ? root : undefined
        
        // 序列化选区用于持久化
        this.state.serializedSelection = (rangy as any).serializeRange(range, true, capturedRoot)
        this.state.currentSerializationRoot = capturedRoot
        this.state.currentMarkIdForColorChange = null
        
        this.actions.applyPreviewHighlight(range)
        this.actions.showTooltipForSelection(event.clientX, event.clientY, capturedText)
      } catch (error) {
        console.error('[InteractionController] Error during selection processing:', error)
        this.ui.hideTooltip()
      }
    } else {
      this.ui.hideTooltip()
    }
  }

  /**
   * 根据点击位置自动扩展选择整个块级元素内容
   */
  private selectBlockFromClick(event: any): rangy.RangyRange | null {
    const shadowRoot = event.path.find((node: Node) => node instanceof ShadowRoot) as ShadowRoot | undefined
    if (shadowRoot) {
      const clickedElement = shadowRoot.elementFromPoint(event.clientX, event.clientY)
      if (clickedElement) {
        const blockElement = this.findContainingBlock(clickedElement)
        if (blockElement && blockElement.textContent?.trim()) {
          const correctedRange = (rangy as any).createRange()
          correctedRange.selectNodeContents(blockElement)
          return correctedRange.collapsed ? null : correctedRange
        }
      }
    }
    return null
  }

  /**
   * 查找最近的块级容器
   */
  private findContainingBlock(node: Node): HTMLElement {
    let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : (node as HTMLElement)
    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const display = window.getComputedStyle(current as Element).display
        if (display === 'block' || display === 'list-item' || display.startsWith('table')) return current as HTMLElement
      }
      if (current.parentNode instanceof ShadowRoot) return current as HTMLElement
      current = current.parentNode
    }
    return node as HTMLElement
  }

  /**
   * 处理点击已存在的标记：加载其元数据并显示 Tooltip
   */
  private handleExistingMarkClick(markElement: HTMLElement, x: number, y: number) {
    const markId = getMarkIdFromElement(markElement)
    if (!markId) return
    
    this.state.currentMarkIdForColorChange = markId
    const allHighlightSpans = querySelectorAllDeep(`.webext-highlight-${markId}`)
    if (allHighlightSpans.length === 0) return
    
    const range = (rangy as any).createRange()
    range.setStartBefore(allHighlightSpans[0])
    range.setEndAfter(allHighlightSpans[allHighlightSpans.length - 1])
    
    const temporarySelection = rangy.getSelection()
    temporarySelection.removeAllRanges()
    temporarySelection.addRange(range)
    
    this.state.currentSerializationRoot = undefined
    const root = range.commonAncestorContainer.getRootNode()
    if (root instanceof ShadowRoot) this.state.currentSerializationRoot = root
    
    this.state.serializedSelection = (rangy as any).serializeSelection(temporarySelection, true, this.state.currentSerializationRoot)
    this.actions.showTooltipForExistingMark(markId, x, y)
  }
}
