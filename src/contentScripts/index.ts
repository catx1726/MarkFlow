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
import type { Mark } from '~/logic/storage'
import { highlightDefaultStyle, shortcuts } from '~/logic/config'
import { isPageBlacklisted, settings, settingsReady } from '~/logic/settings'
import {
  applyPreciseHighlight,
  calculateSimilarity,
  getCanonicalUrlForMark,
  getHighlightContext,
  getMarkIdFromElement,
  querySelectorAllDeep,
  querySelectorDeep,
  getElementSelector,
  stripHighlights
} from '~/logic/dom'
import { findCandidateElements } from '~/logic/search'
import { HighlightStateManager } from './state'
import { UIManager } from './ui'
import '../styles'

// #region --- State Management ---
const state = new HighlightStateManager()
const ui = new UIManager(state, restoreHighlights, scrollToMark)
let restoreDebounceTimer: number
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
    await ui.handleInitialLoadActions()
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
  state.ambiguousMarksQueue.value = []

  const now = Date.now()
  const marksToRestore = marks.filter((mark) => {
    if (state.restoredMarkIds.has(mark.id)) {
      if (querySelectorDeep(`.webext-highlight-${mark.id}`)) return false
      state.restoredMarkIds.delete(mark.id)
    }
    const cooldown = state.failedRestoreCooldowns.get(mark.id)
    if (cooldown && now < cooldown) return false
    return true
  })

  if (marksToRestore.length > 0) await applyMarks(marksToRestore)

  if (state.ambiguousMarksQueue.value.length > 0) {
    console.log(`[WebMarker] Showing modal with ${state.ambiguousMarksQueue.value.length} ambiguous marks`)
    state.disambiguationModalApp?.show(state.ambiguousMarksQueue.value)
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
  if (state.isRestoring) return

  clearTimeout(restoreDebounceTimer)
  restoreDebounceTimer = window.setTimeout(async () => {
    const canonicalUrl = getCanonicalUrlForMark()
    const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')
    if (!marks) return

    const now = Date.now()
    const marksToRestore = marks.filter((mark) => {
      // 已恢复的跳过
      if (state.restoredMarkIds.has(mark.id)) {
        if (querySelectorDeep(`.webext-highlight-${mark.id}`)) return false
        state.restoredMarkIds.delete(mark.id)
      }
      // 已在歧义队列中的跳过，避免重复搜索
      if (state.ambiguousMarksQueue.value.some((m) => m.originalMarkId === mark.id)) return false

      const cooldown = state.failedRestoreCooldowns.get(mark.id)
      if (cooldown && now < cooldown) return false
      return true
    })

    if (marksToRestore.length > 0) {
      state.isRestoring = true
      try {
        await applyMarks(marksToRestore)
        // 如果产生了新的歧义标记，更新/显示弹窗
        if (state.ambiguousMarksQueue.value.length > 0) {
          state.disambiguationModalApp?.show(state.ambiguousMarksQueue.value)
        }
      } finally {
        state.isRestoring = false
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
      state.restoredMarkIds.add(mark.id)
      state.failedRestoreCooldowns.delete(mark.id)
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
            state.restoredMarkIds.add(mark.id)
            state.failedRestoreCooldowns.delete(mark.id)
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
            // 避免因临时的文档漂移导致"错位"被永久记录
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
            const otherMarksInQueue = state.ambiguousMarksQueue.value.filter((m) => m.originalMarkId !== mark.id)
            state.ambiguousMarksQueue.value = [...otherMarksInQueue, candidate]
          }
        } else {
          console.warn(`[WebMarker] Unique candidate context similarity (${similarity}%) low, forcing modal for ${mark.id}`)
          const otherMarksInQueue = state.ambiguousMarksQueue.value.filter((m) => m.originalMarkId !== mark.id)
          state.ambiguousMarksQueue.value = [...otherMarksInQueue, candidate]
        }
      } else if (ambiguityLevel === 'multiple') {
        const otherMarksInQueue = state.ambiguousMarksQueue.value.filter((m) => m.originalMarkId !== mark.id)
        state.ambiguousMarksQueue.value = [...otherMarksInQueue, ...candidates]
      } else {
        state.failedRestoreCooldowns.set(mark.id, Date.now() + 3000)
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
  state.restoredMarkIds.clear()
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
