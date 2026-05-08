/**
 * # Content Script - 网页标记核心逻辑
 *
 * 本文件是浏览器扩展的内容脚本入口，负责网页标记的创建、恢复、交互和搜索。
 *
 * ## 架构概览
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    页面 DOM (Light + Shadow)                │
 * │  ┌─────────────┐    ┌──────────────────┐    ┌────────────┐ │
 * │  │ 普通文本     │    │ Web Component    │    │ 动态内容    │ │
 * │  │             │    │  ┌────────────┐  │    │ (AJAX/SPA) │ │
 * │  │ 高亮 span    │    │  │ Shadow DOM │  │    │            │ │
 * │  │ .webext-    │    │  │ 高亮 span   │  │    │ Mutation   │ │
 * │  │ highlight-* │    │  └────────────┘  │    │ Observer   │ │
 * │  └─────────────┘    └──────────────────┘    └────────────┘ │
 * └─────────────────────────────────────────────────────────────┘
 *                              │
 *                    Rangy 序列化/反序列化
 *                              │
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    Content Script (本文件)                   │
 * │  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐   │
 * │  │ 事件监听    │  │ 标记搜索     │  │ UI (Shadow DOM)   │   │
 * │  │ mousedown  │  │ search.ts    │  │ Tooltip           │   │
 * │  │ mouseup    │→│ (L2/L3)      │  │ Disambiguation    │   │
 * │  │ keydown    │  │ 歧义判定     │  │ (Vue in Shadow)   │   │
 * │  └────────────┘  └──────────────┘  └───────────────────┘   │
 * │                            │                                │
 * │                    webext-bridge 通信                       │
 * └────────────────────────────┼────────────────────────────────┘
 *                              │
 *                     Background Script (存储)
 * ```
 *
 * ## 四级恢复架构 (Restoration Flow)
 *
 * 页面加载时，`restoreHighlights()` → `applyMarks()` 按以下四级流程恢复标记：
 *
 * ```
 * ┌────────────────────────────────────────────────────────────────┐
 * │  applyMarks() - 单个标记恢复流程                                │
 * ├────────────────────────────────────────────────────────────────┤
 * │                                                                │
 * │  try {                                                         │
 * │    ┌─────────────────────────────────────────────────────┐    │
 * │    │ Level 1: 路径还原 (Rangy 反序列化)                   │    │
 * │    │  ├─ 通过 shadowHostSelector 穿透 Shadow DOM 链       │    │
 * │    │  ├─ rangy.deserializeRange() 按节点索引还原          │    │
 * │    │  ├─ 校验: range.toString() === mark.text             │    │
 * │    │  └─ 校验: surroundingSnippet 相似度 100%             │    │
 * │    │     → 通过: applier.applyToRange() → 成功             │    │
 * │    └─────────────────────────────────────────────────────┘    │
 * │  } catch (e) { // Level 1 失败，进入搜索流程                  │
 * │                                                                │
 * │    findCandidateElements()                                     │
 * │    ┌─────────────────────────────────────────────────────┐    │
 * │    │ Level 2: 精确匹配                                    │    │
 * │    │  └─ fullText.indexOf(mark.text)                     │    │
 * │    │     → 可能产生多个候选 (同一文本多次出现)              │    │
 * │    └─────────────────────────────────────────────────────┘    │
 * │    ┌─────────────────────────────────────────────────────┐    │
 * │    │ Level 3: 夹逼搜索 (Sandwich)                        │    │
 * │    │  ├─ 前哨扫描: 前 20 字符相似度 >70%                  │    │
 * │    │  ├─ 后哨扫描: 后 20 字符相似度 >70%                  │    │
 * │    │  └─ 前后哨之间即为目标 (即使中间文字被修改)            │    │
 * │    └─────────────────────────────────────────────────────┘    │
 * │                                                                │
 * │    歧义判定 (Ambiguity Level)                                  │
 * │    ┌─────────────────────────────────────────────────────┐    │
 * │    │ unique: score >= 85 → 自动恢复 (applyPreciseHighlight)│   │
 * │    │ multiple: 加入歧义队列 → DisambiguationModal         │    │
 * │    └─────────────────────────────────────────────────────┘    │
 * │                                                                │
 * │    ┌─────────────────────────────────────────────────────┐    │
 * │    │ Level 4: DisambiguationModal (用户手动确认)          │    │
 * │    │  └─ 用户在弹窗中选择正确的候选位置                    │    │
 * │    └─────────────────────────────────────────────────────┘    │
 * │  }                                                             │
 * │                                                                │
 * └────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Shadow DOM 双层策略
 *
 * ### 1. 页面 Shadow DOM（被标记的内容）
 * Web Components（如 `<video-player>`, `<custom-editor>`）内部的内容同样需要被标记。
 * 解决方案：
 * - **事件捕获**: `addEventListener(..., true)` 在捕获阶段截获 Shadow 内事件
 * - **递归查询**: `querySelectorDeep` 穿透所有层级的 Shadow Root
 * - **序列化隔离**: Rangy 序列化时传入正确的 `root` (ShadowRoot vs Document)
 * - **宿主链记录**: `shadowHostSelector` 用 `|>>>|` 分隔符记录宿主元素路径
 *
 * ### 2. 扩展自身 Shadow DOM（UI 隔离）
 * 扩展的 UI（Tooltip、歧义弹窗）运行在**独立的 Shadow DOM** 中，避免与页面 CSS 冲突。
 * 实现：`setupShadowDOMAndUI()` 创建 `#vitesse-webext` 容器并 attachShadow。
 *
 * ## 标记生命周期
 *
 * 1. **创建**: 用户 Alt+选择文本 → Tooltip → `createHighlight()` → 发送至 Background
 * 2. **恢复**: 页面加载 → `restoreHighlights()` → `applyMarks()` → 四级恢复流程
 * 3. **搜索**: 内容变化 → `findCandidateElements()` → L2 精确 / L3 夹逼 → 歧义弹窗
 * 4. **更新**: 点击高亮 → Tooltip → 修改备注/颜色/删除 → 发送至 Background
 *
 * ## 与 old_stable_index.ts 的区别
 *
 * | 特性 | index.ts (新版) | old_stable_index.ts (旧版) |
 * |------|-----------------|---------------------------|
 * | 恢复架构 | 四级 (L1-L4) | 仅路径还原 |
 * | 搜索算法 | L2 + L3 夹逼搜索 | 无 |
 * | 歧义处理 | DisambiguationModal | 无 |
 * | 上下文提取 | 标题层级 + 周围片段 | 仅标题 |
 * | Shadow DOM | 完整递归穿透 + 宿主链 | 基础支持 |
 *
 * @module contentScripts/index
 */

import { collectError } from '../logic/errorCollector'

window.addEventListener('error', (event) => collectError(event.error, 'content'))
window.addEventListener('unhandledrejection', (event) => collectError(event.reason, 'content'))

/* eslint-disable no-console */
console.log('[WebMarker] CONTENT SCRIPT LOADED AT TOP LEVEL')
import { onMessage, sendMessage } from 'webext-bridge/content-script'
import { createApp, h, reactive, ref } from 'vue'
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-classapplier'
import 'rangy/lib/rangy-serializer'
import Tooltip from './views/Tooltip.vue'
import DisambiguationModal from './views/DisambiguationModal.vue'
import type { Mark } from '~/logic/storage'
import { highlightDefaultStyle, shortcuts } from '~/logic/config'
import { isPageBlacklisted, settings, settingsReady } from '~/logic/settings'
import {
  applyPreciseHighlight,
  calculateSimilarity,
  getAllTextNodes,
  getCanonicalUrlForMark,
  getHighlightContext,
  getMarkIdFromElement,
  getMaxZIndex,
  querySelectorAllDeep,
  querySelectorDeep,
  getElementSelector,
  stripHighlights
} from '~/logic/dom'
import { type Candidate, findCandidateElements } from '~/logic/search'
import '../styles'

// #region --- Type Definitions ---

interface TooltipInstance {
  show: (
    x: number,
    y: number,
    isHighlighted: boolean,
    note: string,
    color: string | undefined,
    textToCopy: string
  ) => void
  hide: () => void
}

interface DisambiguationModalInstance {
  show: (marks: Candidate[]) => void
  hide: () => void
}

// #endregion

// #region --- State Management ---
const restoredMarkIds = new Set<string>()
const failedRestoreCooldowns = new Map<string, number>() // markId -> nextAllowedRetryTimestamp
const ambiguousMarksQueue = ref<Candidate[]>([])

const modalState = reactive({
  marks: [] as Candidate[],
  visible: false
})

let tooltipDebounceTimer: number
let restoreDebounceTimer: number
let selectionTimer: number
let tooltipApp: TooltipInstance | null
let disambiguationModalApp: DisambiguationModalInstance | null = null
let currentSerializationRoot: Node | undefined
let serializedSelection: string | null = null
let currentMarkIdForColorChange: string | null = null
let originalColorForChange: string | null = null
let previewApplier: rangy.RangyClassApplier | null = null
let isRestoring = false
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
    previewApplier = rangy.createClassApplier('webext-highlight-preview', {
      elementTagName: 'span',
      elementAttributes: { style: `${highlightDefaultStyle(settings.value.defaultHighlightColor)} ` },
      normalize: false
    })
    ensureUIMounted()
    window.addEventListener('keydown', handleKeyDown)
    attachListenersToShadowRoots(document)
    handleInitialLoadActions()
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

// #region --- DOM & UI Setup ---

function setupShadowDOMAndUI(): { tooltip: TooltipInstance; modal: DisambiguationModalInstance } {
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

  const uiRoot = document.createElement('div')
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (isDark) uiRoot.classList.add('dark')
  shadowDOM.appendChild(uiRoot)

  // 1. 挂载 Tooltip
  const tooltipRoot = document.createElement('div')
  uiRoot.appendChild(tooltipRoot)
  const tooltipAppInstance = createApp(Tooltip, {
    onSave: handleSaveAction,
    onDelete: handleDeleteAction,
    onColorChange: handleColorChange,
    onClearPreview: handleClearPreview
  }).mount(tooltipRoot) as unknown as TooltipInstance

  // 2. 挂载 DisambiguationModal (使用 render 函数绑定状态和删除事件)
  const modalRoot = document.createElement('div')
  uiRoot.appendChild(modalRoot)
  const modalApp = createApp({
    render: () =>
      h(DisambiguationModal, {
        ambiguousMarksData: modalState.marks,
        modelValue: modalState.visible,
        'onUpdate:modelValue': (val: boolean) => {
          modalState.visible = val
        },
        onConfirmResolution: handleConfirmResolution,
        onDiscardMark: handleDiscardMark, // 物理删除
        onCancel: () => {
          modalState.visible = false
        },
        'onHover-list-item': handleCandidateHover,
        'onLeave-list-item': handleCandidateLeave
      })
  })
  modalApp.mount(modalRoot)

  document.body.appendChild(container)

  return {
    tooltip: tooltipAppInstance,
    modal: {
      show: (marks: Candidate[]) => {
        modalState.marks = marks
        modalState.visible = true
      },
      hide: () => {
        modalState.visible = false
      }
    }
  }
}

async function handleCandidateHover(item: Candidate) {
  const applier = rangy.createClassApplier('webext-highlight-preview-ambiguous', {
    elementTagName: 'span',
    elementAttributes: { style: 'background-color: rgba(255, 165, 0, 0.4); border-bottom: 2px solid orange;' }
  })

  const rangeResult = applyPreciseHighlight(item.candidateElement, item.displayTextSnippet, applier, item.matchIndex)
  if (rangeResult) {
    rangeResult.range.commonAncestorContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function handleCandidateLeave() {
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

async function handleDiscardMark(markId: string) {
  if (confirm('确定要彻底丢弃此标记吗？')) {
    await removeMarkById(markId)
    modalState.marks = modalState.marks.filter((m) => m.originalMarkId !== markId)
    if (modalState.marks.length === 0) modalState.visible = false
  }
}

function ensureUIMounted() {
  const container = document.getElementById(__NAME__)
  if (!container) {
    const { tooltip, modal } = setupShadowDOMAndUI()
    tooltipApp = tooltip
    disambiguationModalApp = modal
  } else {
    container.style.zIndex = `${getMaxZIndex() + 1}`
  }
}

async function handleConfirmResolution(
  selections: { originalMarkId: string; candidateElement: HTMLElement; actualText: string; matchIndex: number }[]
) {
  for (const { originalMarkId, candidateElement, actualText, matchIndex } of selections) {
    const mark = await sendMessage(
      'get-mark-by-id',
      { id: originalMarkId, url: getCanonicalUrlForMark() },
      'background'
    )
    if (mark) {
      const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
        elementTagName: 'span',
        elementAttributes: { style: highlightDefaultStyle(mark.color) }
      })

      const rangeResult = applyPreciseHighlight(candidateElement, actualText, applier, matchIndex)
      if (rangeResult) {
        const { range } = rangeResult
        restoredMarkIds.add(mark.id)

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
  ambiguousMarksQueue.value = ambiguousMarksQueue.value.filter((m) => !restoredMarkIds.has(m.originalMarkId))
}

async function handleInitialLoadActions() {
  try {
    await restoreHighlights()
    const hash = window.location.hash
    if (!hash.startsWith('#__highlight-mark__')) return
    const markId = hash.substring('#__highlight-mark__'.length)
    if (!markId) return
    setTimeout(() => {
      scrollToMark(markId)
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }, 100)
  } catch (error) {
    console.error('Error during initial load actions:', error)
  }
}

function handleColorChange(color: string, isExisting: boolean) {
  if (isExisting) {
    if (currentMarkIdForColorChange) {
      querySelectorAllDeep(`.webext-highlight-${currentMarkIdForColorChange}`).forEach((el) => {
        if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${color}`
      })
    }
  } else {
    if (serializedSelection) {
      clearPreviewHighlight()
      previewApplier = rangy.createClassApplier('webext-highlight-preview', {
        elementTagName: 'span',
        elementAttributes: { style: `${highlightDefaultStyle(color)}` }
      })
      try {
        const root = currentSerializationRoot || document.documentElement
        const win = root instanceof ShadowRoot ? root.ownerDocument.defaultView : window
        rangy.deserializeSelection(serializedSelection, root, win || window)
        previewApplier.applyToSelection()
      } catch (_e) {
        console.error('应用预览高亮失败:', _e)
      } finally {
        rangy.getSelection().removeAllRanges()
      }
    }
  }
}

function handleClearPreview() {
  if (currentMarkIdForColorChange && originalColorForChange) {
    querySelectorAllDeep(`.webext-highlight-${currentMarkIdForColorChange}`).forEach((el) => {
      if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${originalColorForChange}`
    })
  }
  clearPreviewHighlight()
  rangy.getSelection().removeAllRanges()
  originalColorForChange = null
}

// #endregion

// #region --- Event Listeners & Handlers ---

function handleMouseDown(event: MouseEvent) {
  clearTimeout(tooltipDebounceTimer)
  const target = event.target as HTMLElement
  if (target instanceof Element && target.shadowRoot) return
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
  const path = event.composedPath() as HTMLElement[]
  if (path.some((el) => el instanceof HTMLElement && el.classList.contains('tooltip-card'))) return

  if (!target.closest('span[class*="webext-highlight-"]')) {
    tooltipApp?.hide()
    handleClearPreview()
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
  const targetNode = event.target as Node
  const targetElement = (
    targetNode.nodeType === Node.ELEMENT_NODE ? targetNode : targetNode.parentNode
  ) as HTMLElement | null
  const markElement = targetElement?.closest('span[class*="webext-highlight-"]') as HTMLElement | null
  const isNewSelectionAction = event.altKey && !initialSelection.isCollapsed

  if (isNewSelectionAction) {
    clearPreviewHighlight()
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
        // 这样序列化的是干净的 DOM 结构，而在 handleSaveAction 中反序列化之前也会先 clearPreviewHighlight
        serializedSelection = rangy.serializeRange(range, true, capturedRoot)
        currentSerializationRoot = capturedRoot
        currentMarkIdForColorChange = null

        previewApplier?.applyToRange(range)
        showTooltipForSelection(event.clientX, event.clientY, capturedText)
      } catch (e) {
        console.error('[WebMarker] Error during selection processing:', e)
        tooltipApp?.hide()
      }
      return
    }
    tooltipApp?.hide()
    return
  }

  if (markElement && initialSelection.isCollapsed) {
    if (markElement.classList.contains('webext-highlight-preview')) return
    handleExistingMarkClick(markElement, event.clientX, event.clientY)
    return
  }
  tooltipApp?.hide()
  currentMarkIdForColorChange = null
  serializedSelection = null
  currentSerializationRoot = undefined
}

function handleExistingMarkClick(markElement: HTMLElement, x: number, y: number) {
  const markId = getMarkIdFromElement(markElement)
  if (!markId) return
  currentMarkIdForColorChange = markId
  const allSpans = querySelectorAllDeep(`.webext-highlight-${markId}`)
  if (allSpans.length === 0) return
  const range = rangy.createRange()
  range.setStartBefore(allSpans[0])
  range.setEndAfter(allSpans[allSpans.length - 1])
  const tempSelection = rangy.getSelection()
  tempSelection.removeAllRanges()
  tempSelection.addRange(range)
  currentSerializationRoot = undefined
  const root = range.commonAncestorContainer.getRootNode()
  if (root instanceof ShadowRoot) currentSerializationRoot = root
  serializedSelection = rangy.serializeSelection(tempSelection, true, currentSerializationRoot)
  showTooltipForExistingMark(markId, x, y)
}

async function showTooltipForExistingMark(markId: string, x: number, y: number) {
  ensureUIMounted()
  const mark = await sendMessage('get-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
  const note = mark ? mark.note : ''
  const color = mark ? mark.color : settings.value.defaultHighlightColor
  originalColorForChange = color
  tooltipApp?.show(x, y, true, note, color, mark?.text ?? '')
}

function showTooltipForSelection(x: number, y: number, textToCopy: string) {
  clearTimeout(tooltipDebounceTimer)
  tooltipDebounceTimer = window.setTimeout(() => {
    ensureUIMounted()
    tooltipApp?.show(x, y, false, '', settings.value.defaultHighlightColor, textToCopy)
  }, 50)
}

function clearPreviewHighlight() {
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

// #endregion

// #region --- Mark & Highlight CRUD ---

async function handleSaveAction(note: string, color: string) {
  if (currentMarkIdForColorChange) {
    try {
      await sendMessage(
        'update-mark-details',
        { id: currentMarkIdForColorChange, url: getCanonicalUrlForMark(), note, color },
        'background'
      )
      document.querySelectorAll(`.webext-highlight-${currentMarkIdForColorChange}`).forEach((el) => {
        if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${color}`
      })
    } catch (e) {
      console.error('Error during mark update:', e)
    }
  } else {
    clearPreviewHighlight()
    if (!serializedSelection) return
    try {
      const root = currentSerializationRoot || document.documentElement
      const doc = root instanceof ShadowRoot ? root.ownerDocument : document
      const range = rangy.deserializeRange(serializedSelection, root, doc)
      if (range && !range.collapsed) await createHighlight(range, note, color)
    } catch (e) {
      console.error('Error during save action (create):', e)
    }
  }
  currentSerializationRoot = undefined
  serializedSelection = null
  currentMarkIdForColorChange = null
  originalColorForChange = null
  rangy.getSelection().removeAllRanges()
}

async function handleDeleteAction() {
  if (!serializedSelection) return
  try {
    if (currentMarkIdForColorChange) await removeMarkById(currentMarkIdForColorChange)
  } catch (e) {
    console.error('Error during delete action:', e)
  } finally {
    currentSerializationRoot = undefined
    serializedSelection = null
    currentMarkIdForColorChange = null
    originalColorForChange = null
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
  parentsToNormalize.forEach((parent) => parent.normalize())
  await sendMessage('remove-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
}

async function createHighlight(
  rangyRange: rangy.RangyRange,
  note?: string,
  color: string = settings.value.defaultHighlightColor
) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const className = `webext-highlight-${uniqueId}`
  const applier = rangy.createClassApplier(className, {
    elementTagName: 'span',
    elementAttributes: { style: highlightDefaultStyle(color) }
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
  const { contextTitle, contextSelector, contextLevel, contextOrder, surroundingSnippet } =
    getHighlightContext(rangyRange)
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
    surroundingSnippet
  }
  await sendMessage('add-mark', markData, 'background')
}

// #endregion

// #region --- Interaction ---

async function scrollToMark(markId: string) {
  clearTimeout(restoreDebounceTimer)
  const className = `webext-highlight-${markId}`
  const element = querySelectorDeep(`.${className}`)
  if (element) {
    const mark = await sendMessage('get-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
    if (!mark) return
    element.scrollIntoView({ behavior: 'auto', block: 'center' })
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

// #endregion

// #region --- Highlight Restoration ---

async function restoreHighlights() {
  const canonicalUrl = getCanonicalUrlForMark()
  const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')
  if (!marks || marks.length === 0) return
  ambiguousMarksQueue.value = []

  const now = Date.now()
  const marksToRestore = marks.filter((mark) => {
    if (restoredMarkIds.has(mark.id)) {
      if (querySelectorDeep(`.webext-highlight-${mark.id}`)) return false
      restoredMarkIds.delete(mark.id)
    }
    const cooldown = failedRestoreCooldowns.get(mark.id)
    if (cooldown && now < cooldown) return false
    return true
  })

  if (marksToRestore.length > 0) await applyMarks(marksToRestore)

  if (ambiguousMarksQueue.value.length > 0) {
    console.log(`[WebMarker] Showing modal with ${ambiguousMarksQueue.value.length} ambiguous marks`)
    disambiguationModalApp?.show(ambiguousMarksQueue.value)
  }
  const observer = new MutationObserver((mutations) => {
    const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0)
    if (!hasAddedNodes) return
    debouncedRestore()
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // 监听 URL 变化 (针对 SPA)
  window.addEventListener('popstate', debouncedRestore)
  // 拦截 pushState/replaceState
  const originalPushState = history.pushState
  history.pushState = function (...args) {
    originalPushState.apply(this, args)
    debouncedRestore()
  }
}

function debouncedRestore() {
  if (isRestoring) return

  clearTimeout(restoreDebounceTimer)
  restoreDebounceTimer = window.setTimeout(async () => {
    const canonicalUrl = getCanonicalUrlForMark()
    const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')
    if (!marks) return

    const now = Date.now()
    const marksToRestore = marks.filter((mark) => {
      // 已恢复的跳过
      if (restoredMarkIds.has(mark.id)) {
        if (querySelectorDeep(`.webext-highlight-${mark.id}`)) return false
        restoredMarkIds.delete(mark.id)
      }
      // 已在歧义队列中的跳过，避免重复搜索
      if (ambiguousMarksQueue.value.some((m) => m.originalMarkId === mark.id)) return false

      const cooldown = failedRestoreCooldowns.get(mark.id)
      if (cooldown && now < cooldown) return false
      return true
    })

    if (marksToRestore.length > 0) {
      isRestoring = true
      try {
        await applyMarks(marksToRestore)
        // 如果产生了新的歧义标记，更新/显示弹窗
        if (ambiguousMarksQueue.value.length > 0) {
          disambiguationModalApp?.show(ambiguousMarksQueue.value)
        }
      } finally {
        isRestoring = false
      }
    }
    attachListenersToShadowRoots(document)
  }, 300)
}

async function applyMarks(marks: Mark[]) {
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
      else return
    }
    try {
      const range = rangy.deserializeRange(mark.rangySerialized, deserializationRoot, document)
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
      restoredMarkIds.add(mark.id)
      failedRestoreCooldowns.delete(mark.id)
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
        
        // --- 核心改进: 使用精准 snippet 进行上下文校验 ---
        // 之前使用 displayContext (可能是整个 Block)，容易因长度不匹配导致相似度计算过低。
        const similarity = mark.surroundingSnippet
          ? calculateSimilarity(candidate.surroundingSnippet, mark.surroundingSnippet)
          : 100

        if (similarity >= 75) {
          const rangeResult = applyPreciseHighlight(
            candidate.candidateElement,
            candidate.displayTextSnippet,
            applier,
            candidate.matchIndex
          )
          if (rangeResult) {
            const { range } = rangeResult
            restoredMarkIds.add(mark.id)
            failedRestoreCooldowns.delete(mark.id)
            const root = candidate.candidateElement.getRootNode()
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

            // --- 策略改进: 仅在相似度极高时才更新数据库中的序列化路径 ---
            // 避免因临时的文档漂移导致“错位”被永久记录
            if (similarity >= 90) {
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
            }
          } else {
            console.warn(`[WebMarker] applyPreciseHighlight failed for ${mark.id}, forcing modal.`)
            const otherMarksInQueue = ambiguousMarksQueue.value.filter((m) => m.originalMarkId !== mark.id)
            ambiguousMarksQueue.value = [...otherMarksInQueue, candidate]
          }
        } else {
          console.warn(`[WebMarker] Unique candidate context similarity (${similarity}%) low, forcing modal for ${mark.id}`)
          const otherMarksInQueue = ambiguousMarksQueue.value.filter((m) => m.originalMarkId !== mark.id)
          ambiguousMarksQueue.value = [...otherMarksInQueue, candidate]
        }
      } else if (ambiguityLevel === 'multiple') {
        const otherMarksInQueue = ambiguousMarksQueue.value.filter((m) => m.originalMarkId !== mark.id)
        ambiguousMarksQueue.value = [...otherMarksInQueue, ...candidates]
      } else {
        failedRestoreCooldowns.set(mark.id, Date.now() + 3000)
      }
    }
  }
}

async function refreshHighlights() {
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
