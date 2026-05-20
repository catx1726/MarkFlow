import { collectError } from '../logic/errorCollector'

window.addEventListener('error', (event) => collectError(event.error, 'content'))
window.addEventListener('unhandledrejection', (event) => collectError(event.reason, 'content'))

/* eslint-disable no-console */
console.log('[WebMarker] CONTENT SCRIPT LOADED AT TOP LEVEL')
import { onMessage, sendMessage } from 'webext-bridge/content-script'
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-classapplier'
import 'rangy/lib/rangy-serializer'
import { highlightDefaultStyle, shortcuts } from '~/logic/config'
import { isPageBlacklisted, settings, settingsReady } from '~/logic/settings'
import { getCanonicalUrlForMark, getMarkIdFromElement, querySelectorAllDeep, querySelectorDeep } from '~/logic/dom'
import { HighlightStateManager } from './state'
import { UIManager } from './ui'
import { ContentChangeMonitor } from './monitor'
import { HighlightRestorer } from './restorer'
import '../styles'

// #region --- State Management ---
const state = new HighlightStateManager()
const restorer = new HighlightRestorer(state)
const ui = new UIManager(state)
const monitor = new ContentChangeMonitor(async () => {
  if (state.modalState.visible) return
  await restorer.restoreHighlights()
})
let selectionTimer: number
// #endregion

/**
 * 递归地为页面及其所有 Shadow Root 附加鼠标事件监听器。
 */
function attachListenersToShadowRoots(rootNode: Document | ShadowRoot) {
  try {
    if (!rootNode) return
    rootNode.addEventListener('mousedown', handleMouseDown as EventListener, true)
    rootNode.addEventListener('mouseup', handleMouseUp as EventListener, true)
    const allElements = rootNode.querySelectorAll('*')
    for (const element of Array.from(allElements)) {
      if (element.shadowRoot) {
        attachListenersToShadowRoots(element.shadowRoot)
      }
    }
  } catch (error) {
    console.error('Failed to attach shadow listeners:', error)
  }
}

async function initialize() {
  console.log('[ContentScript] Initializing WebMarker...')
  try {
    await settingsReady
    console.log('[ContentScript] Settings ready.')
    if (isPageBlacklisted(window.location.href, settings.value.blacklist)) {
      console.log('[ContentScript] Page is blacklisted, skipping.')
      return
    }
    rangy.init()
    state.previewApplier = rangy.createClassApplier('webext-highlight-preview', {
      elementTagName: 'span',
      elementAttributes: { style: `${highlightDefaultStyle(settings.value.defaultHighlightColor)} ` },
      normalize: false
    })
    ui.ensureMounted()
    window.addEventListener('keydown', handleKeyDown)
    attachListenersToShadowRoots(document)
    const ambiguous = await restorer.restoreHighlights()
    if (ambiguous.length > 0 && !state.modalState.visible) {
      setTimeout(() => {
        if (state.ambiguousMarksQueue.value.length > 0 && !state.modalState.visible) {
          state.disambiguationModalApp?.show(state.ambiguousMarksQueue.value)
        }
      }, 1000)
    }
    {
      const hash = window.location.hash
      if (hash.startsWith('#__highlight-mark__')) {
        const markId = hash.substring('#__highlight-mark__'.length)
        if (markId) {
          setTimeout(() => {
            try {
              restorer.scrollToMark(markId)
              history.replaceState(null, '', window.location.pathname + window.location.search)
            } catch (error) {
              console.error('Error during scroll to mark:', error)
            }
          }, 100)
        }
      }
    }
    monitor.setupGlobalObserver()
    monitor.setupBodyObserver()
    monitor.setupSPAListener()
    console.log('[ContentScript] Initialization complete.')
  } catch (e) {
    console.error('[ContentScript] Initialization failed:', e)
  }
}

initialize()

function handleKeyDown(event: KeyboardEvent) {
  const [mod, key] = shortcuts.openSidePanel.split('+')
  if (event.altKey && mod.toLowerCase() === 'alt' && event.key.toLowerCase() === key.toLowerCase()) {
    event.preventDefault()
  }
}

// #endregion

// #region --- Event Listeners & Handlers ---

function handleMouseDown(event: MouseEvent) {
  ui.cancelTooltipDebounce()
  // 修复：使用 composedPath 获取实际目标，处理 Shadow DOM 事件重定向
  const actualTarget = event.composedPath().find((el) => el instanceof HTMLElement) as HTMLElement | undefined
  const target = actualTarget || (event.target as HTMLElement)
  if (target instanceof Element && target.shadowRoot) return
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
  const path = event.composedPath() as HTMLElement[]
  if (path.some((el) => el instanceof HTMLElement && el.classList.contains('tooltip-card'))) return

  if (!target.closest('span[class*="webext-highlight-"]')) {
    state.tooltipApp?.hide()
    ui.clearPreviewWithColorRestore()
  }
}

function handleMouseUp(event: MouseEvent) {
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
  clearTimeout(selectionTimer)
  selectionTimer = window.setTimeout(() => processSelection(eventSnapshot), 50)
}

// #endregion

// #region --- Selection Processing & Tooltip ---

function findContainingBlock(node: Node): HTMLElement {
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

function processSelection(event: {
  target: EventTarget | null
  path: EventTarget[]
  clientX: number
  clientY: number
  altKey: boolean
  detail: number
}) {
  const initialSelection = rangy.getSelection()
  // 修复：使用 composedPath 中的实际目标元素，正确处理 Shadow DOM 内的事件重定向
  const actualTargetNode = (event.path.find((el) => el instanceof Node && el.nodeType === Node.ELEMENT_NODE) as HTMLElement | undefined) || (event.target as HTMLElement | null)
  const targetNode = actualTargetNode as Node
  const targetElement = (
    targetNode.nodeType === Node.ELEMENT_NODE ? targetNode : targetNode.parentNode
  ) as HTMLElement | null
  const markElement = targetElement?.closest('span[class*="webext-highlight-"]') as HTMLElement | null
  console.log('[TooltipDebug] processSelection:', {
    markElement: !!markElement,
    isCollapsed: initialSelection?.isCollapsed,
    rangeCount: initialSelection?.rangeCount,
    altKey: event.altKey,
    className: markElement?.className,
    targetTag: (targetNode as HTMLElement)?.tagName,
    targetClass: (targetNode as HTMLElement)?.className,
    targetId: (targetNode as HTMLElement)?.id
  })
  const isNewSelectionAction = event.altKey && !initialSelection.isCollapsed

  if (isNewSelectionAction) {
    ui.clearPreviewHighlight()
    let range: rangy.RangyRange | null = null
    if (event.detail >= 3) {
      const shadowRoot = event.path.find((node) => node instanceof ShadowRoot) as ShadowRoot | undefined
      if (shadowRoot) {
        const clickedElement = shadowRoot.elementFromPoint(event.clientX, event.clientY)
        if (clickedElement) {
          const blockElement = findContainingBlock(clickedElement)
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

        // --- 核心修复: 先序列化，再应用预览 ---
        // 这样序列化的是干净的 DOM 结构，而在 handleSave 中反序列化之前也会先 clearPreviewHighlight
        state.serializedSelection = rangy.serializeRange(range, true, capturedRoot)
        state.currentSerializationRoot = capturedRoot
        state.currentMarkIdForColorChange = null

        state.previewApplier?.applyToRange(range)
        ui.showTooltip(event.clientX, event.clientY, false, '', settings.value.defaultHighlightColor, capturedText, [])
      } catch (e) {
        console.error('[WebMarker] Error during selection processing:', e)
        state.tooltipApp?.hide()
      }
      return
    }
    state.tooltipApp?.hide()
    return
  }

  if (markElement && initialSelection.isCollapsed) {
    if (markElement.classList.contains('webext-highlight-preview')) return
    handleExistingMarkClick(markElement, event.clientX, event.clientY)
    return
  }
  state.tooltipApp?.hide()
  state.currentMarkIdForColorChange = null
  state.serializedSelection = null
  state.currentSerializationRoot = undefined
}

function handleExistingMarkClick(markElement: HTMLElement, x: number, y: number) {
  const markId = getMarkIdFromElement(markElement)
  if (!markId) return
  state.currentMarkIdForColorChange = markId
  const allSpans = querySelectorAllDeep(`.webext-highlight-${markId}`)
  if (allSpans.length === 0) return
  const range = rangy.createRange()
  range.setStartBefore(allSpans[0])
  range.setEndAfter(allSpans[allSpans.length - 1])
  const tempSelection = rangy.getSelection()
  tempSelection.removeAllRanges()
  tempSelection.addRange(range)
  state.currentSerializationRoot = undefined
  const root = range.commonAncestorContainer.getRootNode()
  if (root instanceof ShadowRoot) state.currentSerializationRoot = root
  state.serializedSelection = rangy.serializeSelection(tempSelection, true, state.currentSerializationRoot)
  showTooltipForExistingMark(markId, x, y)
}

async function showTooltipForExistingMark(markId: string, x: number, y: number) {
  ui.ensureMounted()
  const mark = await sendMessage('get-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
  const note = mark ? mark.note : ''
  const color = mark ? mark.color : settings.value.defaultHighlightColor
  const tags = mark ? mark.tags : undefined
  ui.setOriginalColorForChange(color)
  state.tooltipApp?.show(x, y, true, note, color, mark?.text ?? '', tags)
}

// #endregion

// #region --- WebExtension Message Listeners ---
onMessage('refresh-highlights', async () => {
  await restorer.refreshHighlights()
})
onMessage('tab-prev', ({ data }) => {
  console.log(`[web-marker-extension] Navigate from page "${data.title}"`)
})
onMessage('goto-mark', ({ data }) => {
  restorer.scrollToMark(data.markId)
})
onMessage('remove-mark', async ({ data: markToRemove }) => {
  if (!markToRemove || !markToRemove.id) return
  await ui.removeMarkById(markToRemove.id)
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
// #endregion
