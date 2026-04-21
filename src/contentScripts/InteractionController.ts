import rangy from 'rangy/lib/rangy-core'
import type { AppState, IInteractionController, IUIPortal } from './types'
import {
  getMarkIdFromElement,
  querySelectorAllDeep,
  getCanonicalUrlForMark
} from '~/logic/dom'
import { sendMessage } from 'webext-bridge/content-script'

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

  setupListeners() {
    this.attachListenersToShadowRoots(document)
  }

  private attachListenersToShadowRoots(rootNode: Document | ShadowRoot) {
    try {
      if (!rootNode) return
      rootNode.addEventListener('mousedown', ((e: MouseEvent) => this.handleMouseDown(e)) as EventListener, true)
      rootNode.addEventListener('mouseup', ((e: MouseEvent) => this.handleMouseUp(e)) as EventListener, true)
      const allElements = rootNode.querySelectorAll('*')
      for (const element of Array.from(allElements)) {
        if (element.shadowRoot) {
          this.attachListenersToShadowRoots(element.shadowRoot)
        }
      }
    } catch (error) {
      console.error('Failed to attach shadow listeners:', error)
    }
  }

  private handleMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (target instanceof Element && target.shadowRoot) return
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
    const path = event.composedPath() as HTMLElement[]
    if (path.some((el) => el instanceof HTMLElement && el.classList.contains('tooltip-card'))) return

    if (!target.closest('span[class*="webext-highlight-"]')) {
      this.ui.hideTooltip()
      this.actions.clearPreviewHighlight()
    }
  }

  private handleMouseUp(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
    const path = event.composedPath()
    if (event.button === 2 || path.some((el) => el instanceof HTMLElement && el.classList.contains('tooltip-card')))
      return
    const eventSnapshot = {
      target,
      path: typeof event.composedPath === 'function' ? event.composedPath() : [target],
      clientX: event.clientX,
      clientY: event.clientY,
      altKey: event.altKey,
      detail: event.detail
    }
    clearTimeout(this.selectionTimer)
    this.selectionTimer = window.setTimeout(() => this.processSelection(eventSnapshot), 50) as any
  }

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
    const isNewSelectionAction = event.altKey && !initialSelection.isCollapsed

    if (isNewSelectionAction) {
      this.actions.clearPreviewHighlight()
      let range: rangy.RangyRange | null = null
      if (event.detail >= 3) {
        const shadowRoot = event.path.find((node) => node instanceof ShadowRoot) as ShadowRoot | undefined
        if (shadowRoot) {
          const clickedElement = shadowRoot.elementFromPoint(event.clientX, event.clientY)
          if (clickedElement) {
            const blockElement = this.findContainingBlock(clickedElement)
            if (blockElement && blockElement.textContent?.trim()) {
              const correctedRange = rangy.createRange()
              correctedRange.selectNodeContents(blockElement)
              if (!correctedRange.collapsed) range = correctedRange
            }
          }
        }
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
          this.state.serializedSelection = rangy.serializeRange(range, true, capturedRoot)
          this.state.currentSerializationRoot = capturedRoot
          this.state.currentMarkIdForColorChange = null
          this.actions.applyPreviewHighlight(range)
          this.actions.showTooltipForSelection(event.clientX, event.clientY, capturedText)
        } catch (e) {
          console.error('[WebMarker] Error during selection processing:', e)
          this.ui.hideTooltip()
        }
        return
      }
      this.ui.hideTooltip()
      return
    }

    if (markElement && initialSelection.isCollapsed) {
      if (markElement.classList.contains('webext-highlight-preview')) return
      this.handleExistingMarkClick(markElement, event.clientX, event.clientY)
      return
    }
    this.ui.hideTooltip()
    this.state.currentMarkIdForColorChange = null
    this.state.serializedSelection = null
    this.state.currentSerializationRoot = undefined
  }

  private handleExistingMarkClick(markElement: HTMLElement, x: number, y: number) {
    const markId = getMarkIdFromElement(markElement)
    if (!markId) return
    this.state.currentMarkIdForColorChange = markId
    const allSpans = querySelectorAllDeep(`.webext-highlight-${markId}`)
    if (allSpans.length === 0) return
    const range = rangy.createRange()
    range.setStartBefore(allSpans[0])
    range.setEndAfter(allSpans[allSpans.length - 1])
    const tempSelection = rangy.getSelection()
    tempSelection.removeAllRanges()
    tempSelection.addRange(range)
    this.state.currentSerializationRoot = undefined
    const root = range.commonAncestorContainer.getRootNode()
    if (root instanceof ShadowRoot) this.state.currentSerializationRoot = root
    this.state.serializedSelection = rangy.serializeSelection(tempSelection, true, this.state.currentSerializationRoot)
    this.actions.showTooltipForExistingMark(markId, x, y)
  }
}
