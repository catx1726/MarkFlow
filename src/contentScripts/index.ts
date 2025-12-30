/* eslint-disable no-console */
import { onMessage, sendMessage } from 'webext-bridge/content-script'
import { createApp } from 'vue'
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-classapplier'
import 'rangy/lib/rangy-serializer'
import Tooltip from './views/Tooltip.vue'
import { type Mark } from '~/logic/storage'
import { highlightDefaultStyle, shortcuts } from '~/logic/config'
import { isPageBlacklisted, settings, settingsReady } from '~/logic/settings'
import '../styles'

type RangySelection = ReturnType<typeof rangy.getSelection>

// #region --- Type Definitions ---

/**
 * 为 Vue Tooltip 实例定义接口以增强类型安全
 */
interface TooltipInstance {
  show(x: number, y: number, isHighlighted: boolean, note: string, color: string | undefined, textToCopy: string): void
  hide(): void
}

// #endregion

// #region --- State Management ---
// 用于跟踪已成功恢复到页面上的标记，避免重复操作
const restoredMarkIds = new Set<string>()

let tooltipDebounceTimer: number,
  restoreDebounceTimer: number,
  selectionTimer: number,
  tooltipApp: TooltipInstance | null,
  currentSelection: RangySelection | null = null,
  currentSerializationRoot: Node | undefined,
  serializedSelection: string | null = null,
  currentMarkIdForColorChange: string | null = null, // 当前正在编辑颜色的标记ID
  contextIdCounter = 0,
  previewApplier: rangy.RangyClassApplier | null = null

/**
 * 递归地遍历 DOM 并为所有 Shadow Root 附加鼠标事件监听器。
 * 这是捕获 Web Components 内部选区所必需的。
 * @param {Document | ShadowRoot} rootNode 起始节点 (document 或一个 shadow root)。
 */
function attachListenersToShadowRoots(rootNode: Document | ShadowRoot) {
  try {
    if (!rootNode) return

    // 将事件监听器强制转换为 EventListener 类型以兼容 addEventListener
    rootNode.addEventListener('mousedown', handleMouseDown as EventListener, true)
    rootNode.addEventListener('mouseup', handleMouseUp as EventListener, true)

    // 遍历所有元素以查找 Shadow Root
    const allElements = rootNode.querySelectorAll('*')
    for (const element of Array.from(allElements)) {
      if (element.shadowRoot) {
        // console.log('[DEBUG] Found nested Shadow Root on:', element.tagName)
        attachListenersToShadowRoots(element.shadowRoot)
      }
      // attachListenersToShadowRoots((currentNode as Element).shadowRoot!)
    }
  } catch (error) {
    console.error('Failed to attach shadow listeners:', error)
  }
}

async function initialize() {
  await settingsReady

  if (isPageBlacklisted(window.location.href, settings.value.blacklist)) {
    console.info('[web-marker-extension] Page is blacklisted. Extension disabled.')
    return
  }

  rangy.init()
  console.info('[web-marker-extension] Hello world from content script')

  previewApplier = rangy.createClassApplier('webext-highlight-preview', {
    elementTagName: 'span',
    elementAttributes: { style: `${highlightDefaultStyle(settings.value.defaultHighlightColor)} ` },
    normalize: false // Prevent rangy from merging text nodes, which can invalidate serialized selections
  })

  tooltipApp = setupShadowDOMAndTooltip()

  // 移除了 window 上的监听器，因为 attachListenersToShadowRoots(document) 会处理主文档。
  // window.addEventListener('mousedown', handleMouseDown, true)
  // window.addEventListener('mouseup', handleMouseUp, true)
  window.addEventListener('keydown', handleKeyDown)

  // 为页面上所有的 Shadow Root 附加监听器，以处理 Web Components 内的选区。
  attachListenersToShadowRoots(document)

  // 监听动态加载的内容，确保 Shadow DOM 监听器被正确附加
  setupGlobalObserver()

  // 处理页面初始加载时的操作，如恢复高亮和滚动到指定标记
  handleInitialLoadActions()
}

initialize()

function handleKeyDown(event: KeyboardEvent) {
  const [mod, key] = shortcuts.openSidePanel.split('+')
  if (event.altKey && mod.toLowerCase() === 'alt' && event.key.toLowerCase() === key.toLowerCase()) {
    event.preventDefault()
  }
}

/**
 * 设置一个全局的 MutationObserver 来监视动态添加的内容。
 * 这对于确保在 Web Components (Shadow DOM) 被 JS 延迟加载到页面后，
 * 我们的事件监听器仍然可以被正确附加至关重要。
 */
let globalObserverTimer: number
function setupGlobalObserver() {
  const observer = new MutationObserver((mutations) => {
    // 如果有任何节点被添加，我们就认为 DOM 可能发生了需要我们关注的变化。
    const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0)
    if (hasAddedNodes) {
      // 使用防抖来避免在 DOM 快速变化时频繁执行。
      clearTimeout(globalObserverTimer)
      globalObserverTimer = window.setTimeout(() => {
        // 重新扫描整个文档以查找并附加监听器到任何新的 Shadow Root。
        attachListenersToShadowRoots(document)
      }, 500)
    }
  })
  // 观察 body 的子节点和整个子树的变化。
  observer.observe(document.body, { childList: true, subtree: true })
}

// #endregion

// #region --- DOM & UI Setup ---

/**
 * 设置 Shadow DOM 并挂载 Tooltip Vue 组件
 * @returns Tooltip 组件的实例
 */
function setupShadowDOMAndTooltip(): TooltipInstance {
  const container = document.createElement('div')
  container.id = __NAME__
  container.style.position = 'fixed'
  container.style.zIndex = `${getMaxZIndex() + 1}`
  container.style.fontSize = '16px'

  const shadowDOM = container.attachShadow?.({ mode: 'open' }) || container

  const styleEl = document.createElement('link')
  styleEl.setAttribute('rel', 'stylesheet')
  styleEl.setAttribute('href', browser.runtime.getURL('dist/contentScripts/style.css'))
  shadowDOM.appendChild(styleEl)

  const root = document.createElement('div')
  shadowDOM.appendChild(root)

  // 为工具提示创建一个单独的根
  const tooltipRoot = document.createElement('div'),
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (isDark) tooltipRoot.classList.add('dark')

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (e.matches) tooltipRoot.classList.add('dark')
    else tooltipRoot.classList.remove('dark')
  })
  shadowDOM.appendChild(tooltipRoot)

  document.body.appendChild(container)

  // 挂载工具提示组件
  const app = createApp(Tooltip, {
    onSave: handleSaveAction,
    onDelete: handleDeleteAction,
    onColorChange: handleColorChange,
    onClearPreview: handleClearPreview
  })

  return app.mount(tooltipRoot) as unknown as TooltipInstance
}

/**
 * 确保 Tooltip 容器已挂载且具有正确的 z-index。
 * 这解决了在单页应用（SPA）中，因 DOM 重绘导致 Tooltip 容器被移除的问题。
 */
function ensureTooltipMounted() {
  const container = document.getElementById(__NAME__)
  if (!container) {
    console.log('[WebMarker] ensureTooltipMounted: Container NOT found, remounting...')
    tooltipApp = setupShadowDOMAndTooltip()
  } else {
    console.log('[WebMarker] ensureTooltipMounted: Container found, updating z-index')
    container.style.zIndex = `${getMaxZIndex() + 1}`
  }
}

/**
 * 处理页面初始加载时的操作，恢复高亮并滚动到指定标记
 */
async function handleInitialLoadActions() {
  try {
    await restoreHighlights()
    console.log('Highlights restored.')

    const hash = window.location.hash
    if (!hash.startsWith('#__highlight-mark__')) return

    const markId = hash.substring('#__highlight-mark__'.length)
    if (!markId) return

    // 使用一个小的延迟确保高亮渲染和页面布局稳定
    setTimeout(() => {
      scrollToMark(markId)
      // 清理 URL，避免刷新时再次滚动
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }, 100)
  } catch (error) {
    console.error('Error during highlight restoration or scrolling:', error)
  }
}

function handleColorChange(color: string, isExisting: boolean) {
  if (isExisting) {
    // 对于已存在的标注，直接更新样式以避免闪烁
    if (currentMarkIdForColorChange) {
      querySelectorAllDeep(`.webext-highlight-${currentMarkIdForColorChange}`).forEach((el) => {
        if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${color}`
      })
    }
  } else {
    // 对于新选区，更新预览高亮
    if (serializedSelection) {
      // 首先，移除现有的预览高亮。
      // 这个函数会清理预览的 span 并合并文本节点，
      // 确保 DOM 恢复到可以安全地反序列化选区的状态。
      clearPreviewHighlight()

      // 使用新颜色创建一个新的 applier
      previewApplier = rangy.createClassApplier('webext-highlight-preview', {
        elementTagName: 'span',
        elementAttributes: { style: `${highlightDefaultStyle(color)}` }
      })

      try {
        // 关键修复：为反序列化提供正确的文档上下文（shadowRoot 或 document）
        const root = currentSerializationRoot || document.documentElement
        const win = root instanceof ShadowRoot ? root.ownerDocument.defaultView : window
        rangy.deserializeSelection(serializedSelection, root, win || window)
        // 将新的预览高亮应用到已恢复的全局选区上
        previewApplier.applyToSelection()
      } catch (e) {
        console.error('应用预览高亮失败:', e)
      } finally {
        // 操作完成后，清除页面上的可见选区
        rangy.getSelection().removeAllRanges()
      }
    }
  }
}

/**
 * Handles the request to clear the preview highlight.
 */
function handleClearPreview() {
  clearPreviewHighlight()
  // Also clear the underlying text selection from the screen
  rangy.getSelection().removeAllRanges()
}

// #endregion

// #region --- Event Listeners & Handlers ---

function handleMouseDown(event: MouseEvent) {
  clearTimeout(tooltipDebounceTimer)

  const target = event.target as HTMLElement,
    tagName = target.tagName

  if (target instanceof Element && target.shadowRoot) return

  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable) {
    return
  }

  const path = event.composedPath() as HTMLElement[]

  const isInsideTooltip = path.some((el) => {
    return el instanceof HTMLElement && el.classList.contains('tooltip-card')
  })

  // 点击在工具提示内部，不做任何事，让事件正常传播到其内部元素（如按钮）。
  if (isInsideTooltip) return

  // 点击在工具提示外部，如果目标不是一个高亮，则隐藏工具提示。
  if (!target.closest('span[class*="webext-highlight-"]')) {
    tooltipApp?.hide()
  }
}

function handleMouseUp(event: MouseEvent) {
  const target = event.target as HTMLElement,
    tagName = target.tagName

  // 1. 检查 INPUT 或 TEXTAREA 标签
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
    // 如果在表单元素中mouseup，则不触发选区处理
    return
  }

  // 2. 检查 contentEditable (富文本编辑器)
  // 如果目标元素或其祖先是 contentEditable，则不触发
  if (target.isContentEditable) {
    return
  }

  const path = event.composedPath()
  // 忽略右键点击或在工具提示内部的 mouseup 事件
  if (event.button === 2 || path.some((el) => el instanceof HTMLElement && el.classList.contains('tooltip-card')))
    return

  // 延迟一小段时间确保选区稳定
  // 关键修复：同步捕获 target，避免在 setTimeout 中因事件冒泡/重定向导致 target 变为 Shadow Host
  const eventSnapshot = {
    target,
    path: typeof event.composedPath === 'function' ? event.composedPath() : [target],
    clientX: event.clientX,
    clientY: event.clientY,
    altKey: event.altKey,
    detail: event.detail
  }
  console.log(`[WebMarker] handleMouseUp: scheduling processSelection ${event.detail}`)
  clearTimeout(selectionTimer)
  selectionTimer = window.setTimeout(() => processSelection(eventSnapshot), 50) // 50ms is a good balance
}

// #endregion

// #region --- Selection Processing & Tooltip ---
/**
 * 从给定节点开始，向上查找并返回第一个块级（block-level）父元素。
 * 这对于确定用户意图选择的整个段落或内容块至关重要。
 * @param node - 开始查找的 DOM 节点。
 * @returns 找到的块级 HTMLElement，如果找不到则回退到原始节点。
 */
function findContainingBlock(node: Node): HTMLElement {
  let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : (node as HTMLElement)
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const display = window.getComputedStyle(current as Element).display
      if (display === 'block' || display === 'list-item' || display.startsWith('table')) return current as HTMLElement
    }
    // 如果我们遇到了 Shadow Root 的边界，那么包含块就是当前节点本身（它是 Shadow Host 的子节点）。
    if (current.parentNode instanceof ShadowRoot) return current as HTMLElement

    current = current.parentNode
  }
  return node as HTMLElement // Fallback
}

/**
 * 处理用户选择或点击操作
 */
function processSelection(event: {
  target: EventTarget | null
  path: EventTarget[]
  clientX: number
  clientY: number
  altKey: boolean
  detail: number
}) {
  console.log('[WebMarker] processSelection started')
  const initialSelection = rangy.getSelection()
  const targetNode = event.target as Node

  const targetElement = (
    targetNode.nodeType === Node.ELEMENT_NODE ? targetNode : targetNode.parentNode
  ) as HTMLElement | null
  const markElement = targetElement?.closest('span[class*="webext-highlight-"]') as HTMLElement | null

  const isNewSelectionAction = (event.altKey || event.detail >= 3) && !initialSelection.isCollapsed

  if (isNewSelectionAction) {
    console.log(`[WebMarker] New selection action detected (alt=${event.altKey}, detail=${event.detail}).`)

    // 1. 清理 DOM。这会移除旧的预览并合并文本节点，但可能会破坏当前的浏览器选区。
    console.log('[WebMarker] Clearing old preview to get a clean DOM state.')
    clearPreviewHighlight()

    let range: rangy.RangyRange | null = null

    // 2. 为新操作获取权威的 range。
    // 对于 Shadow DOM 中的三击，我们需要特殊处理来重建 range，因为 getSelection() 在这里不可靠。
    if (event.detail >= 3) {
      const shadowRoot = event.path.find((node) => node instanceof ShadowRoot) as ShadowRoot | undefined
      if (shadowRoot) {
        console.log('🎯 [WebMarker] Shadow DOM Triple-click detected. Reconstructing range on clean DOM.')
        const clickedElement = shadowRoot.elementFromPoint(event.clientX, event.clientY)
        if (clickedElement) {
          const blockElement = findContainingBlock(clickedElement)
          if (blockElement && blockElement.textContent?.trim()) {
            const correctedRange = rangy.createRange()
            correctedRange.selectNodeContents(blockElement)
            if (!correctedRange.collapsed) {
              range = correctedRange
              console.log('  - Range reconstructed for Shadow DOM.')
            }
          }
        }
      }
    }

    // 对于所有其他情况（普通三击，Alt+拖拽），我们从清理后的 DOM 中获取一个新的选区。
    if (!range) {
      console.log('[WebMarker] Getting fresh selection from document after cleaning.')
      const freshSelection = rangy.getSelection()
      if (freshSelection.rangeCount > 0 && !freshSelection.isCollapsed) {
        range = freshSelection.getRangeAt(0)
        console.log('[WebMarker] Successfully got a fresh selection range.')
      } else {
        console.warn('[WebMarker] Selection was lost after DOM normalization. Aborting preview.')
      }
    }

    // 3. 如果我们有一个有效的 range，就处理它。
    if (range && !range.collapsed) {
      const capturedText = range.toString().trim()
      if (!capturedText) {
        console.log('[WebMarker] New selection is whitespace only, ignoring.')
        return
      }

      console.log('[WebMarker] Processing new valid range.')
      try {
        // 4. 在干净的 DOM 上序列化。这是最关键的一步。
        const root = range.commonAncestorContainer.getRootNode()
        const capturedRoot = root instanceof ShadowRoot ? root : undefined
        serializedSelection = rangy.serializeRange(range, true, capturedRoot)
        currentSerializationRoot = capturedRoot
        currentMarkIdForColorChange = null
        console.log('[WebMarker] Selection serialized on clean DOM.', { serialized: serializedSelection })

        // 5. 应用预览。
        console.log('[WebMarker] Applying preview to the new range.')
        previewApplier?.applyToRange(range)
        showTooltipForSelection(event.clientX, event.clientY, capturedText)
      } catch (e) {
        console.error('[WebMarker] Error during serialization or preview application:', e)
        tooltipApp?.hide()
      }
      return
    }

    // 如果到这里，说明新选区操作后没有得到有效的 range。
    tooltipApp?.hide()
    return
  }

  // --- 如果不是新选区操作，则执行旧逻辑 ---

  // 如果点击的目标不是一个预览高亮，那么清除任何可能存在的预览。
  const isPreview = markElement && markElement.classList.contains('webext-highlight-preview')
  if (!isPreview) {
    clearPreviewHighlight()
  }

  // 处理对已存在高亮标记的点击
  if (markElement && initialSelection.isCollapsed) {
    if (markElement.classList.contains('webext-highlight-preview')) return
    handleExistingMarkClick(markElement, event.clientX, event.clientY)
    return
  }

  // 点击页面其他地方，无任何操作
  tooltipApp?.hide()
  currentMarkIdForColorChange = null
  serializedSelection = null
  currentSerializationRoot = undefined
}

/**
 * 处理对已存在高亮标记的点击
 */
function handleExistingMarkClick(markElement: HTMLElement, x: number, y: number) {
  const markId = getMarkIdFromElement(markElement)

  if (!markId) return

  currentMarkIdForColorChange = markId // 为实时颜色更新存储 markId

  // 重建整个标记的范围以获取其序列化信息，这对于删除操作是必要的
  const allSpans = querySelectorAllDeep(`.webext-highlight-${markId}`)
  if (allSpans.length === 0) return

  const firstSpan = allSpans[0]
  const lastSpan = allSpans[allSpans.length - 1]
  const range = rangy.createRange()
  range.setStartBefore(firstSpan)
  range.setEndAfter(lastSpan)

  // 使用一个临时的选区来序列化范围，然后立即清除它
  // const tempSelection = rangy.getSelection()
  // tempSelection.removeAllRanges()
  // tempSelection.addRange(range)
  const tempSelection = rangy.getSelection()
  tempSelection.removeAllRanges()
  tempSelection.addRange(range)

  currentSerializationRoot = undefined
  const root = range.commonAncestorContainer.getRootNode()
  if (root instanceof ShadowRoot) {
    currentSerializationRoot = root
  }
  serializedSelection = rangy.serializeSelection(tempSelection, true, currentSerializationRoot)

  showTooltipForExistingMark(markId, x, y)
}

/**
 * 为已存在的高亮标记显示工具提示
 */
async function showTooltipForExistingMark(markId: string, x: number, y: number) {
  ensureTooltipMounted()

  // 当点击一个标记时调用此函数。此时 `serializedSelection` 已被设置。
  const mark = await sendMessage('get-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background'),
    note = mark ? mark.note : '',
    color = mark ? mark.color : settings.value.defaultHighlightColor
  tooltipApp?.show(x, y, true, note, color, mark?.text ?? '')
}

/**
 * 为新的文本选择显示工具提示
 */
function showTooltipForSelection(x: number, y: number, textToCopy: string) {
  console.log('[WebMarker] showTooltipForSelection: scheduling _showTooltipForSelection')
  // 使用 clearTimeout 和 setTimeout 实现防抖
  clearTimeout(tooltipDebounceTimer)
  tooltipDebounceTimer = window.setTimeout(() => {
    _showTooltipForSelection(x, y, textToCopy)
  }, 50)
}

/**
 * 实际显示tooltip的函数，为了防抖
 * @param x
 * @param y
 * @param textToCopy
 */
function _showTooltipForSelection(x: number, y: number, textToCopy: string) {
  console.log('[WebMarker] _showTooltipForSelection: executing')
  ensureTooltipMounted()

  // 对于新选区，我们处于“创建”模式，isHighlighted 应为 false，这样“删除”按钮就不会显示。
  const isHighlighted = false,
    note = ''
  tooltipApp?.show(x, y, isHighlighted, note, settings.value.defaultHighlightColor, textToCopy)
}

/**
 * 清除预览高亮。
 */
function clearPreviewHighlight() {
  const previewElements = querySelectorAllDeep('.webext-highlight-preview')
  const parentsToNormalize = new Set<Node>()

  previewElements.forEach((el) => {
    if (!(el instanceof HTMLElement)) return

    // If the element has other highlight classes, just remove the preview class.
    if (
      el.className.split(' ').some((cls) => cls.startsWith('webext-highlight-') && cls !== 'webext-highlight-preview')
    ) {
      el.classList.remove('webext-highlight-preview')
    } else {
      // Otherwise, it's a pure preview span, so unwrap it.
      const parent = el.parentNode
      if (parent) {
        parentsToNormalize.add(parent)
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el)
        }
        parent.removeChild(el)
      }
    }
  })

  parentsToNormalize.forEach((parent) => parent.normalize())
}

// #endregion

// #region --- Mark & Highlight CRUD ---

async function handleSaveAction(note: string, color: string) {
  // 情况 1: 更新现有标记。
  // 我们知道这一点，因为当用户点击标记时 `currentMarkIdForColorChange` 已被设置。
  // 这种方法可以避免不必要的 `deserializeSelection`，从而解决了闪烁问题。
  if (currentMarkIdForColorChange) {
    try {
      await sendMessage(
        'update-mark-details',
        { id: currentMarkIdForColorChange, url: getCanonicalUrlForMark(), note, color },
        'background'
      )
      // 颜色可能已在 `handleColorChange` 的实时预览中更新，
      // 但我们在这里再次设置以确保最终状态正确。
      document.querySelectorAll(`.webext-highlight-${currentMarkIdForColorChange}`).forEach((el) => {
        if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${color}`
      })
    } catch (e) {
      console.error('Error during mark update:', e)
    }
  } else {
    // 情况 2: 从选区创建新高亮。
    clearPreviewHighlight()
    if (!serializedSelection) return

    try {
      const root = currentSerializationRoot || document.documentElement
      const doc = root instanceof ShadowRoot ? root.ownerDocument : document
      // --- 增加日志 ---
      console.log('[WebMarker] handleSaveAction: Attempting to deserialize range.', {
        serialized: serializedSelection,
        root
      })
      const range = rangy.deserializeRange(serializedSelection, root, doc)
      if (range && !range.collapsed) await createHighlight(range, note, color)
    } catch (e) {
      console.error('Error during save action (create):', e)
    }
  }

  // 无论哪种情况，最后都清理状态。
  currentSelection = null
  currentSerializationRoot = undefined
  serializedSelection = null
  currentMarkIdForColorChange = null
  rangy.getSelection().removeAllRanges()
}

async function handleDeleteAction() {
  if (!serializedSelection) return

  try {
    // Simplified delete logic: It relies on `currentMarkIdForColorChange` which is set
    // when an existing mark is clicked. This is more robust than re-deserializing a selection.
    if (currentMarkIdForColorChange) {
      await removeMarkById(currentMarkIdForColorChange)
    } else {
      console.warn('[WebMarker] Delete action called without a mark ID.')
    }
  } catch (e) {
    console.error('Error during delete action:', e)
  } finally {
    currentSelection = null
    currentSerializationRoot = undefined
    serializedSelection = null
    currentMarkIdForColorChange = null
    rangy.getSelection().removeAllRanges()
  }
}

async function removeMarkById(markId: string) {
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
  // 移除高亮 span 后，需要规范化父节点以合并相邻的文本节点
  parentsToNormalize.forEach((parent) => parent.normalize())

  // 通知背景脚本从存储中删除标记
  await sendMessage('remove-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
}

async function createHighlight(
  rangyRange: rangy.RangyRange,
  note?: string,
  color: string = settings.value.defaultHighlightColor
) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const className = `webext-highlight-${uniqueId}`

  // console.log('[WebMarker] Creating highlight with class:', className)
  const applier = rangy.createClassApplier(className, {
    elementTagName: 'span',
    elementAttributes: {
      style: highlightDefaultStyle(color)
    }
  })

  const root = rangyRange.commonAncestorContainer.getRootNode()

  let shadowHostSelector: string | undefined
  if (root instanceof ShadowRoot) {
    // 构建从 Document 到当前 Shadow Root 的完整选择器链
    const chain: string[] = []
    let currRoot: Node = root
    while (currRoot instanceof ShadowRoot) {
      chain.unshift(getElementSelector(currRoot.host))
      currRoot = currRoot.host.getRootNode()
    }
    shadowHostSelector = chain.join('|>>>|')
  }

  // 2. 序列化选区：使用转换后的 rangyRange
  const rangySerialized = rangy.serializeRange(rangyRange, true, root instanceof ShadowRoot ? root : undefined)

  const selectedText = rangyRange.toString()

  // 获取结构化上下文 (如果是自定义函数，请确保其支持原生或包装后的 Range)
  const { contextTitle, contextSelector, contextLevel, contextOrder } = getHighlightContext(rangyRange)

  const content = rangyRange.cloneContents()
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(content)

  const selectedHtml = content.constructor === DocumentFragment ? tempDiv.innerHTML : selectedText

  // console.log('[WebMarker] Applying highlight to range:', rangyRange)

  // 3. 应用高亮：使用转换后的 rangyRange
  applier.applyToRange(rangyRange)

  // 准备存储数据
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
    contextOrder
  }

  // 存储到背景脚本
  await sendMessage('add-mark', markData, 'background')
}

/**
 * 获取高亮选区的上下文（最近的上级标题）
 * @param range - Rangy Range 对象
 * @returns 返回包含标题文本、选择器和级别的对象
 */
function getHighlightContext(range: rangy.RangyRange): {
  contextTitle: string
  contextSelector: string
  contextLevel: number
  contextOrder: number
} {
  // Use the start of the range as the reference point.
  const startNode = range.startContainer
  const startElement = (
    startNode.nodeType === Node.ELEMENT_NODE ? startNode : startNode.parentNode
  ) as HTMLElement | null
  const allHeadings = Array.from(querySelectorAllDeep('h1, h2, h3, h4, h5, h6'))
  let lastHeadingBeforeSelection: HTMLElement | null = null

  for (const heading of allHeadings) {
    // Node.DOCUMENT_POSITION_FOLLOWING means `startElement` is after `heading`.
    // We want the last heading that comes before our selection.
    if (startElement && heading.compareDocumentPosition(startElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
      lastHeadingBeforeSelection = heading as HTMLElement
    } else {
      // Once we find a heading that is after our selection, we can stop.
      // The one we found in the previous iteration is the correct one.
      break
    }
  }

  const heading = lastHeadingBeforeSelection
  if (heading) {
    const tagName = heading.tagName.toLowerCase()
    const level = parseInt(tagName.replace('h', ''), 10)
    const documentOrderIndex = allHeadings.indexOf(heading)

    return {
      contextTitle: heading.textContent?.trim() || '无标题章节',
      contextSelector: getElementSelector(heading),
      contextLevel: level,
      contextOrder: documentOrderIndex
    }
  }

  // 如果没有找到标题，则返回默认值
  return {
    contextTitle: '未分类笔记',
    contextSelector: 'body',
    contextLevel: 7,
    contextOrder: -1 // 未分类笔记排在最前面
  }
}

// #endregion

// #region --- Utility Functions ---
/**
 * Generates a CSS selector for a given element.
 * @param el The element to generate a selector for.
 * @returns A CSS selector string.
 */
function getElementSelector(el: Element): string {
  if (!el || !(el instanceof Element)) return ''
  if (el.id) {
    return `#${CSS.escape(el.id)}`
  }
  const path: string[] = []
  let current: Element | null = el
  while (current) {
    let selector = current.tagName.toLowerCase()
    if (selector === 'body') {
      path.unshift(selector)
      break
    }
    const parent = current.parentElement
    if (!parent) {
      path.unshift(selector)
      break
    }
    const siblings = Array.from(parent.children).filter((child) => child.tagName === current!.tagName)
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1
      selector += `:nth-of-type(${index})`
    }
    path.unshift(selector)
    current = parent
  }
  return path.join(' > ')
}

/**
 * Recursively searches for an element matching the selector, piercing through Shadow DOMs.
 * @param selector The CSS selector to search for.
 * @param root The root node to start searching from (document or a ShadowRoot).
 * @returns The first matching element or null.
 */
function querySelectorDeep(selector: string, root: Document | ShadowRoot = document): Element | null {
  // First, try to find in the current root.
  const found = root.querySelector(selector)
  if (found) return found

  // If not found, search in all shadow roots within the current root.
  const allElements = root.querySelectorAll('*')
  for (const element of Array.from(allElements)) {
    if (element.shadowRoot) {
      const foundInShadow = querySelectorDeep(selector, element.shadowRoot)
      if (foundInShadow) return foundInShadow
    }
  }

  return null
}

/**
 * Recursively searches for all elements matching the selector, piercing through Shadow DOMs.
 * @param selector The CSS selector to search for.
 * @param root The root node to start searching from (document or a ShadowRoot).
 * @returns An array of matching elements.
 */
function querySelectorAllDeep(selector: string, root: Document | ShadowRoot = document): Element[] {
  let results: Element[] = []
  // Find in the current root.
  root.querySelectorAll(selector).forEach((el) => results.push(el))
  // Find in all shadow roots within the current root.
  const allElements = root.querySelectorAll('*')
  for (const element of Array.from(allElements)) {
    if (element.shadowRoot) results = results.concat(querySelectorAllDeep(selector, element.shadowRoot))
  }
  return results
}

/**
 * 用于获取页面上最高且有效的 z-index 值。
 * 1. 专注于查找可能设置 z-index 的元素 (例如具有 id 或类名的元素)。
 * 2. 遍历 document.body 的直接子元素（通常高层级覆盖物会挂载在 body 下）。
 * 3. 仅对具有 position 属性的元素计算 z-index。
 * 4. 增加了对 Shadow DOM 的有限支持（需要额外的遍历逻辑，此处简化）。
 * @returns {number} 页面中最大的有效 z-index 值。
 */
export function getMaxZIndex(): number {
  let maxZIndex = 0

  // 1. 针对性查找：只查找 body 下的直接子元素，这些元素通常是最高层级的容器
  //    以及那些可能设置了高 z-index 的定位元素。
  const selectors = 'body > *' // 查找 body 的所有直接子元素
  const elements = document.querySelectorAll(selectors)

  elements.forEach((el) => {
    // 性能优化：直接使用 element.style.zIndex 可能会错过 CSS 样式表中的值
    const style = window.getComputedStyle(el),
      zIndexString = style.zIndex,
      position = style.position

    // 2. 核心校验: z-index 只有在 position 不是 'static' 时才生效
    if (zIndexString !== 'auto' && position !== 'static') {
      const zIndex = parseInt(zIndexString)

      if (!isNaN(zIndex)) {
        maxZIndex = Math.max(maxZIndex, zIndex)
      }
    }
  })

  // 考虑常见的模态框和固定元素的最大值，设置一个安全上限
  // 许多模态框使用 9999 或 2147483647
  return Math.max(maxZIndex, 1000)
}

async function scrollToMark(markId: string) {
  // 在滚动前清除任何待定的恢复操作，以防止它们在滚动动画期间改变布局
  clearTimeout(restoreDebounceTimer)

  const className = `webext-highlight-${markId}`
  const element = querySelectorDeep(`.${className}`)
  if (element) {
    const mark = await sendMessage('get-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
    if (!mark) return

    element.scrollIntoView({ behavior: 'auto', block: 'center' })
    // 可以给目标元素一个短暂的闪烁效果以提示用户
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

/**
 * 获取当前页面的规范化 URL，移除哈希和尾部斜杠
 */
function getCanonicalUrlForMark(): string {
  const { origin, pathname } = window.location
  // 移除尾部斜杠，但保留根路径的斜杠
  const cleanedPathname = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return origin + cleanedPathname
}

function findMarkElementInRange(range: Range): HTMLElement | null {
  // 快速路径：检查共同祖先节点是否在高亮标记内部
  const ancestor = range.commonAncestorContainer
  const el = ancestor.nodeType === Node.ELEMENT_NODE ? (ancestor as HTMLElement) : ancestor.parentElement
  const closestMark = el?.closest('span[class*="webext-highlight-"]')
  if (closestMark) return closestMark as HTMLElement

  // 备用路径：如果选区跨越多个节点，检查选区内的任何元素节点是否为高亮标记
  // @ts-expect-error rangy range has getNodes
  const nodes = range.getNodes([Node.ELEMENT_NODE])
  return (
    nodes.find((node: HTMLElement) => node.tagName === 'SPAN' && node.className.includes('webext-highlight-')) || null
  )
}

function getMarkIdFromElement(element: HTMLElement): string | null {
  const highlightClass = Array.from(element.classList).find((c) => c.startsWith('webext-highlight-'))
  return highlightClass ? highlightClass.replace('webext-highlight-', '') : null
}
// #endregion

// #region --- Highlight Restoration ---
/**
 * 恢复高亮的主函数
 */
async function restoreHighlights() {
  // 1. 从背景脚本获取当前 URL 的所有标记
  const canonicalUrl = getCanonicalUrlForMark()
  console.log(`[content-script] Requesting marks for: ${canonicalUrl}`)
  const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')

  console.log('restoreHighlights', marks)
  if (!marks || marks.length === 0) return

  // 2. 尝试应用这些标记
  const marksToRestore = marks.filter((mark) => !restoredMarkIds.has(mark.id))
  applyMarks(marksToRestore)

  // 3. 设置一个 DOM 变化观察者，以处理动态加载的内容
  const observer = new MutationObserver((mutations) => {
    // 我们只关心节点添加操作
    const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0)
    if (!hasAddedNodes) return

    // 使用防抖（debounce）来避免在 DOM 快速变化时频繁执行恢复操作
    debouncedRestore()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

/**
 * 防抖函数，用于在 DOM 稳定一小段时间后再次尝试恢复高亮
 */
function debouncedRestore() {
  clearTimeout(restoreDebounceTimer)
  restoreDebounceTimer = window.setTimeout(async () => {
    const canonicalUrl = getCanonicalUrlForMark(),
      marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')
    if (!marks) return
    const marksToRestore = marks.filter((mark) => !restoredMarkIds.has(mark.id))
    if (marksToRestore.length > 0) applyMarks(marksToRestore)

    // 重新扫描可能被动态添加的 Shadow Root。
    attachListenersToShadowRoots(document)
  }, 500)
}

/**
 * 遍历并应用标记到页面上
 */
function applyMarks(marks: Mark[]) {
  marks.forEach((mark) => {
    // 为每个标记创建特定的 applier
    const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
      elementTagName: 'span',
      elementAttributes: { style: highlightDefaultStyle(mark.color) }
    })

    let deserializationRoot: Node | undefined

    // 如果标记数据中包含 shadowHostSelector，说明它位于 Shadow DOM 中
    if (mark.shadowHostSelector) {
      let host: Element | null = null
      // console.log('[WebMarker] Restoring Shadow DOM mark:', mark.id, mark.shadowHostSelector)
      // 支持新的链式选择器，解决嵌套 Shadow DOM 的定位歧义问题
      if (mark.shadowHostSelector.includes('|>>>|')) {
        const chain = mark.shadowHostSelector.split('|>>>|')
        let currentRoot: Document | ShadowRoot = document

        for (const selector of chain) {
          host = currentRoot.querySelector(selector)
          if (host && host.shadowRoot) {
            currentRoot = host.shadowRoot
          } else {
            host = null
            break
          }
        }
      } else {
        // 兼容旧数据：尝试全局搜索（可能会有歧义，但在简单场景下有效）
        host = querySelectorDeep(mark.shadowHostSelector)
      }
      if (host && host.shadowRoot) {
        // 找到宿主元素，并将其 shadowRoot 作为反序列化的根节点
        deserializationRoot = host.shadowRoot
      } else {
        // 宿主元素尚未加载（例如在动态内容中），MutationObserver 将在稍后重试
        return // 在 forEach 中相当于 continue
      }
    }

    try {
      // 关键改动：反序列化时传入正确的根节点（默认为 document）
      const range = rangy.deserializeRange(mark.rangySerialized, deserializationRoot, document)
      // console.log('[WebMarker] Deserialized range for restore:', range)
      applier.applyToRange(range)
      // rangy.getSelection().removeAllRanges() // 不再需要清除选区，因为我们没有操作全局选区
      // 如果成功，记录下来，不再重复尝试
      restoredMarkIds.add(mark.id)
    } catch (e) {
      // 在动态页面上，部分标记恢复失败是正常现象，MutationObserver 会在后续重试
      // console.warn(`Failed to restore mark ${mark.id}:`, e)
    }
  })
}

async function refreshHighlights() {
  // 移除所有现有的高亮（预览除外）
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

  // 清除已恢复的 ID 缓存并重新应用所有标记
  restoredMarkIds.clear()
  await restoreHighlights()
}

// #endregion

// #region --- WebExtension Message Listeners ---
onMessage('refresh-highlights', async () => {
  await refreshHighlights()
})

onMessage('tab-prev', ({ data }) => {
  console.log(`[web-marker-extension] Navigate from page "${data.title}"`)
})

onMessage('goto-mark', ({ data }) => {
  scrollToMark(data.markId)
})

onMessage('remove-mark', async ({ data: markToRemove }) => {
  if (!markToRemove || !markToRemove.id) return

  await removeMarkById(markToRemove.id)
})

onMessage('goto-chapter', ({ data }) => {
  const { selector } = data
  const element = querySelectorDeep(selector)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // 给目标元素一个短暂的闪烁效果以提示用户
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
