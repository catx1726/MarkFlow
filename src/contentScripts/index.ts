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
 * │ └─────────────────────────────────────────────────────────────┘
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
 * 实现：`UIManager.ensureMounted()` 创建 `#vitesse-webext` 容器并 attachShadow。
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
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-classapplier'
import 'rangy/lib/rangy-serializer'
import { highlightDefaultStyle, shortcuts } from '~/logic/config'
import { isPageBlacklisted, settings, settingsReady } from '~/logic/settings'
import {
  getCanonicalUrlForMark,
  getMarkIdFromElement,
  querySelectorAllDeep,
  querySelectorDeep,
} from '~/logic/dom'
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
    await restorer.restoreHighlights()
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
  const target = event.target as HTMLElement
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
  const targetNode = event.target as Node
  const targetElement = (
    targetNode.nodeType === Node.ELEMENT_NODE ? targetNode : targetNode.parentNode
  ) as HTMLElement | null
  const markElement = targetElement?.closest('span[class*="webext-highlight-"]') as HTMLElement | null
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
        ui.showTooltip(event.clientX, event.clientY, false, '', settings.value.defaultHighlightColor, capturedText)
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
  ui.setOriginalColorForChange(color)
  state.tooltipApp?.show(x, y, true, note, color, mark?.text ?? '')
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
