/* eslint-disable no-console */
import { onMessage, sendMessage } from 'webext-bridge/content-script'
import { createApp, watch } from 'vue'
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-classapplier'
import 'rangy/lib/rangy-serializer'
import Tooltip from './views/Tooltip.vue'
import { type Mark } from '~/logic/storage'
import { highlightDefaultStyle, shortcuts } from '~/logic/config'
import { settings, settingsReady } from '~/logic/settings'
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

let debounceTimer: number,
  tooltipApp: TooltipInstance | null,
  currentSelection: RangySelection | null = null,
  serializedSelection: string | null = null,
  currentMarkIdForColorChange: string | null = null,
  previewApplier: rangy.RangyClassApplier | null = null

async function initialize() {
  await settingsReady

  if (isBlacklisted(window.location.href, settings.value.blacklist)) {
    console.info('[web-marker-extension] Page is blacklisted. Extension disabled.')
    return
  }

  rangy.init()
  console.info('[web-marker-extension] Hello world from content script')

  previewApplier = rangy.createClassApplier('webext-highlight-preview', {
    elementTagName: 'span',
    elementAttributes: { style: `${highlightDefaultStyle(settings.value.defaultHighlightColor)} ` }
  })

  tooltipApp = setupShadowDOMAndTooltip()

  // 注册事件监听器
  window.addEventListener('mousedown', handleMouseDown, true)
  window.addEventListener('mouseup', handleMouseUp, true)
  window.addEventListener('keydown', handleKeyDown)

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

// #endregion

// #region --- DOM & UI Setup ---

/**
 * 设置 Shadow DOM 并挂载 Tooltip Vue 组件
 * @returns Tooltip 组件的实例
 */
function setupShadowDOMAndTooltip(): TooltipInstance {
  const container = document.createElement('div')
  container.id = __NAME__
  container.style.position = 'relative'
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
      document.querySelectorAll(`.webext-highlight-${currentMarkIdForColorChange}`).forEach((el) => {
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
        // 恢复之前保存的选区
        rangy.deserializeSelection(serializedSelection)
        // 将新的预览高亮应用到已恢复的选区上
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
  clearTimeout(debounceTimer)

  const target = event.target as HTMLElement
  const tagName = target.tagName

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
  setTimeout(() => processSelection(event), 50)
}

// #endregion

// #region --- Selection Processing & Tooltip ---

/**
 * 处理用户选择或点击操作
 */
function processSelection(event: MouseEvent) {
  const selection = rangy.getSelection(),
    targetNode = event.target as Node,
    targetElement = (targetNode.nodeType === Node.ELEMENT_NODE ? targetNode : targetNode.parentNode) as HTMLElement,
    markElement = targetElement?.closest('span[class*="webext-highlight-"]') as HTMLElement | null

  // 优化：处理在预览高亮上再次选择的问题
  // 如果用户在预览高亮区域内操作...
  if (markElement && markElement.classList.contains('webext-highlight-preview')) {
    // ...但他们没有创建一个新的选区（即，只是单击），
    // 那么我们什么也不做。这允许他们与工具提示进行交互。
    if (selection.isCollapsed) {
      return
    }
    // 否则，如果他们确实创建了一个新的选区（例如双击或拖动），我们将继续向下处理它。
  }

  // 在处理新选区或点击之前，清除任何现有的预览高亮
  clearPreviewHighlight()

  // 情况1：用户选择了新的文本
  if (!selection.isCollapsed) {
    if (event.altKey) handleNewSelection(selection, event.clientX, event.clientY)
    return
  }

  // 情况2：用户点击了已存在的高亮标记
  if (markElement) {
    // 此时 markElement 不会是 'webext-highlight-preview'
    handleExistingMarkClick(markElement, event.clientX, event.clientY)
    return
  }

  // 情况3：用户点击了页面的其他地方，并且没有选择文本
  tooltipApp?.hide()
}

/**
 * 处理新的文本选择
 */
function handleNewSelection(selection: RangySelection, x: number, y: number) {
  // 修正：在序列化之前“烘焙”选区。
  // 双击并拖动以选择文本有时会导致浏览器以“单词”为单位扩展选区。
  // 当之后反序列化这个选区时，它可能会意外地收缩回最初双击的那个单词。
  // 通过克隆范围并重新添加它，我们创建了一个没有这种“模式”记忆的新选区，
  // 确保保存的是用户看到的完整选区。
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0).cloneRange()
    selection.removeAllRanges()
    selection.addRange(range)
  }
  currentSelection = selection
  currentMarkIdForColorChange = null // 这是一个新选区，不是已存在的标注
  serializedSelection = rangy.serializeSelection(selection, true)
  // 立即应用预览高亮
  previewApplier?.applyToSelection()
  showTooltipForSelection(x, y, selection.toString())
}

/**
 * 处理对已存在高亮标记的点击
 */
function handleExistingMarkClick(markElement: HTMLElement, x: number, y: number) {
  const markId = getMarkIdFromElement(markElement)

  if (!markId) return

  currentMarkIdForColorChange = markId // 为实时颜色更新存储 markId

  // 重建整个标记的范围以获取其序列化信息，这对于删除操作是必要的
  const allSpans = document.querySelectorAll(`.webext-highlight-${markId}`)
  if (allSpans.length === 0) return

  const firstSpan = allSpans[0]
  const lastSpan = allSpans[allSpans.length - 1]
  const range = rangy.createRange()
  range.setStartBefore(firstSpan)
  range.setEndAfter(lastSpan)

  // 使用一个临时的选区来序列化范围，然后立即清除它
  const tempSelection = rangy.getSelection()
  tempSelection.removeAllRanges()
  tempSelection.addRange(range)
  serializedSelection = rangy.serializeSelection(tempSelection, true)
  tempSelection.removeAllRanges() // 立即清理

  showTooltipForExistingMark(markId, x, y)
}

/**
 * 为已存在的高亮标记显示工具提示
 */
async function showTooltipForExistingMark(markId: string, x: number, y: number) {
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
  // 对于新选区，我们处于“创建”模式，isHighlighted 应为 false，这样“删除”按钮就不会显示。
  const isHighlighted = false,
    note = ''
  tooltipApp?.show(x, y, isHighlighted, note, settings.value.defaultHighlightColor, textToCopy)
}

/**
 * 清除预览高亮。
 */
function clearPreviewHighlight() {
  const previewElements = document.querySelectorAll('.webext-highlight-preview')
  const parentsToNormalize = new Set<Node>()

  previewElements.forEach((el) => {
    if (!(el instanceof HTMLElement)) return

    // 如果元素还有其他高亮类，只移除预览类。
    if (
      el.className.split(' ').some((cls) => cls.startsWith('webext-highlight-') && cls !== 'webext-highlight-preview')
    ) {
      el.classList.remove('webext-highlight-preview')
    } else {
      // 否则，它是一个纯粹的预览 span，所以解包它。
      const parent = el.parentNode
      if (parent) {
        parentsToNormalize.add(parent)
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
      }
    }
  })

  // 强制合并相邻的文本节点，以确保 DOM 状态与序列化时完全一致。
  // 这是为了防止因 `applyToSelection` 分割文本节点而导致的 `deserializeSelection` 失败。
  parentsToNormalize.forEach((parent) => {
    parent.normalize()
  })
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
      rangy.deserializeSelection(serializedSelection)
      const selection = rangy.getSelection()
      if (selection && !selection.isCollapsed) await createHighlight(selection, note, color)
    } catch (e) {
      console.error('Error during save action (create):', e)
    }
  }

  // 无论哪种情况，最后都清理状态。
  currentSelection = null
  serializedSelection = null
  currentMarkIdForColorChange = null
  rangy.getSelection().removeAllRanges()
}

async function handleDeleteAction() {
  if (!serializedSelection) return

  try {
    rangy.deserializeSelection(serializedSelection)
    const selection = rangy.getSelection()

    if (!selection || selection.isCollapsed) return

    const markElement = findMarkElementInSelection(selection)
    if (markElement) {
      const markId = getMarkIdFromElement(markElement)
      if (markId) await removeMarkById(markId)
    }
  } catch (e) {
    console.error('Error during delete action:', e)
  } finally {
    currentSelection = null
    serializedSelection = null
    currentMarkIdForColorChange = null
    rangy.getSelection().removeAllRanges()
  }
}

async function removeMarkById(markId: string) {
  const className = `webext-highlight-${markId}`
  const parentsToNormalize = new Set<Node>()

  document.querySelectorAll(`.${className}`).forEach((el) => {
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
  selection: RangySelection,
  note?: string,
  color: string = settings.value.defaultHighlightColor
) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    className = `webext-highlight-${uniqueId}`,
    applier = rangy.createClassApplier(className, {
      elementTagName: 'span',
      elementAttributes: {
        style: highlightDefaultStyle(color)
      }
    }),
    // 序列化选区，用于之后恢复和取消高亮
    rangySerialized = rangy.serializeSelection(selection, true),
    selectedText = selection.toString(),
    // 获取结构化上下文
    { contextTitle, contextSelector, contextLevel, contextOrder } = getHighlightContext(selection)

  // 应用高亮
  applier.applyToSelection()

  // 清除用户在屏幕上的选区
  selection.removeAllRanges()

  // 准备要存储的数据
  const markData: Mark = {
    id: uniqueId,
    url: getCanonicalUrlForMark(),
    text: selectedText,
    note: note || '',
    color,
    rangySerialized,
    createdAt: Date.now(),
    title: document.title,
    contextTitle,
    contextSelector,
    contextLevel,
    contextOrder
  }

  // 通过 webext-bridge 将新标记发送到背景脚本进行存储
  await sendMessage('add-mark', markData, 'background')
}

/**
 * 获取高亮选区的上下文（最近的上级标题）
 * @param selection - Rangy 选区对象
 * @returns 返回包含标题文本、选择器和级别的对象
 */
function getHighlightContext(selection: RangySelection): {
  contextTitle: string
  contextSelector: string
  contextLevel: number
  contextOrder: number
} {
  const range = selection.getRangeAt(0),
    // Use the start of the range as the reference point.
    startNode = range.startContainer,
    startElement = (startNode.nodeType === Node.ELEMENT_NODE ? startNode : startNode.parentNode) as HTMLElement | null,
    allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
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
    const tagName = heading.tagName.toLowerCase(),
      level = parseInt(tagName.replace('h', ''), 10),
      headingsOfSameLevel = Array.from(document.querySelectorAll(tagName)),
      index = headingsOfSameLevel.indexOf(heading),
      documentOrderIndex = allHeadings.indexOf(heading) // 这就是标题在文档中的顺序

    return {
      contextTitle: heading.textContent?.trim() || '无标题章节',
      contextSelector: `${tagName}:nth-of-type(${index + 1})`,
      contextLevel: level,
      contextOrder: documentOrderIndex
    }
  }

  // 如果没有找到标题，则返回默认值
  return {
    contextTitle: '未分类笔记',
    contextSelector: 'body',
    contextLevel: 1,
    contextOrder: -1 // 未分类笔记排在最前面
  }
}

// #endregion

// #region --- Utility Functions ---
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

function isBlacklisted(url: string, blacklist: string[]): boolean {
  try {
    const hostname = new URL(url).hostname
    return blacklist.some((pattern) => hostname.endsWith(pattern))
  } catch {
    return false
  }
}

async function scrollToMark(markId: string) {
  // 在滚动前清除任何待定的恢复操作，以防止它们在滚动动画期间改变布局
  clearTimeout(debounceTimer)

  const className = `webext-highlight-${markId}`
  const element = document.querySelector(`.${className}`)
  if (element) {
    const mark = await sendMessage('get-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
    if (!mark) return

    element.scrollIntoView({ behavior: 'auto', block: 'center' })
    // 可以给目标元素一个短暂的闪烁效果以提示用户
    document.querySelectorAll(`.${className}`).forEach((el) => {
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

function findMarkElementInSelection(selection: RangySelection): HTMLElement | null {
  if (selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)

  // 快速路径：检查共同祖先节点是否在高亮标记内部
  const ancestor = range.commonAncestorContainer
  const el = ancestor.nodeType === Node.ELEMENT_NODE ? (ancestor as HTMLElement) : ancestor.parentElement
  const closestMark = el?.closest('span[class*="webext-highlight-"]')
  if (closestMark) return closestMark as HTMLElement

  // 备用路径：如果选区跨越多个节点，检查选区内的任何元素节点是否为高亮标记
  const nodes = range.getNodes([Node.ELEMENT_NODE])
  return (
    (nodes.find(
      (node) =>
        (node as HTMLElement).tagName === 'SPAN' && (node as HTMLElement).className.includes('webext-highlight-')
    ) as HTMLElement) || null
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
  clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(async () => {
    const canonicalUrl = getCanonicalUrlForMark(),
      marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')
    if (!marks) return
    const marksToRestore = marks.filter((mark) => !restoredMarkIds.has(mark.id))
    if (marksToRestore.length > 0) applyMarks(marksToRestore)
  }, 500)
}

/**
 * 遍历并应用标记到页面上
 */
function applyMarks(marks: Mark[]) {
  for (const mark of marks) {
    const className = `webext-highlight-${mark.id}`
    const applier = rangy.createClassApplier(className, {
      elementTagName: 'span',
      elementAttributes: { style: highlightDefaultStyle(mark.color) }
    })

    try {
      rangy.deserializeSelection(mark.rangySerialized)
      applier.applyToSelection()
      rangy.getSelection().removeAllRanges()
      // 如果成功，记录下来，不再重复尝试
      restoredMarkIds.add(mark.id)
    } catch (e) {
      // 在动态页面上，部分标记恢复失败是正常现象，MutationObserver 会在后续重试
    }
  }
}

async function refreshHighlights() {
  // 移除所有现有的高亮（预览除外）
  const highlights = document.querySelectorAll('span[class*="webext-highlight-"]')
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
  const element = document.querySelector(selector)
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
