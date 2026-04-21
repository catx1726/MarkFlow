/**
 * # 恢复引擎 (Restoration Engine)
 * 
 * 本模块负责网页标记的持久化恢复与增量自愈。
 * 核心架构：**四级恢复流 (Tiered Restoration Flow)**。
 * 
 * 1. Level 1: 路径还原 (Rangy 反序列化)
 * 2. Level 2: 精确文本匹配 (Exact Match)
 * 3. Level 3: 模糊共识搜索 (Consensus Match)
 * 4. Level 4: 歧义手动纠偏 (Manual Disambiguation)
 */

import { sendMessage } from 'webext-bridge/content-script'
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-serializer'
import 'rangy/lib/rangy-classapplier'
import type { AppState, IRestorationEngine } from './types'
import type { Mark } from '~/logic/storage'
import {
  getCanonicalUrlForMark,
  calculateSimilarity,
  getHighlightContext,
  stripHighlights,
  getElementSelector,
  querySelectorDeep,
  Highlighter
} from '~/logic/dom'
import { highlightDefaultStyle } from '~/logic/config'
import { findCandidateElements } from '~/logic/search'

export class RestorationEngine implements IRestorationEngine {
  private restoredMarkIds = new Set<string>()
  private failedRestoreCooldowns = new Map<string, number>()
  private restoreDebounceTimer: number | undefined
  private isRestoringMarks = false

  constructor(
    private state: AppState, 
    private actions: { onAmbiguity: (candidates: any[]) => void }
  ) {}

  /**
   * 启动全量恢复逻辑
   */
  async restore() {
    const canonicalUrl = getCanonicalUrlForMark()
    const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background') as Mark[]
    
    if (!marks || marks.length === 0) return

    const now = Date.now()
    const marksToRestore = marks.filter((mark) => {
      // 1. 如果已恢复且在页面中存在，则跳过
      if (this.restoredMarkIds.has(mark.id)) {
        if (querySelectorDeep(`.webext-highlight-${mark.id}`)) return false
        this.restoredMarkIds.delete(mark.id)
      }
      
      // 2. 冷却检查：避免对已知无法恢复的标记进行高频重试
      const cooldownTimestamp = this.failedRestoreCooldowns.get(mark.id)
      if (cooldownTimestamp && now < cooldownTimestamp) return false
      
      return true
    })

    if (marksToRestore.length > 0) await this.applyMarks(marksToRestore)
  }

  /**
   * 防抖恢复：适用于处理 MutationObserver 触发的频繁变更
   */
  debouncedRestore() {
    if (this.isRestoringMarks) return

    clearTimeout(this.restoreDebounceTimer)
    this.restoreDebounceTimer = window.setTimeout(async () => {
      this.isRestoringMarks = true
      try {
        await this.restore()
      } finally {
        this.isRestoringMarks = false
      }
    }, 300) as any
  }

  /**
   * 设置全局 DOM 观察者与 URL 变化监听
   */
  setupObserver() {
    // 监听 DOM 节点新增
    const observer = new MutationObserver((mutations) => {
      const hasAddedNodes = mutations.some((mutation) => mutation.addedNodes.length > 0)
      if (hasAddedNodes) this.debouncedRestore()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    // 监听 SPA 路由变化
    window.addEventListener('popstate', () => this.debouncedRestore())
    
    const originalPushState = history.pushState
    history.pushState = (data: any, unused: string, url?: string | URL | null) => {
      originalPushState.call(history, data, unused, url)
      this.debouncedRestore()
    }
  }

  /**
   * 核心恢复算法：按优先级尝试恢复标记
   */
  async applyMarks(marks: Mark[]) {
    for (const mark of marks) {
      const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
        elementTagName: 'span',
        elementAttributes: { style: highlightDefaultStyle(mark.color) }
      })

      // 1. 确定反序列化的根节点 (处理 Shadow DOM 穿透)
      const deserializationRoot = this.resolveDeserializationRoot(mark.shadowHostSelector)
      if (mark.shadowHostSelector && !deserializationRoot) continue

      try {
        // --- Level 1: 路径还原 ---
        const range = (rangy as any).deserializeRange(mark.rangySerialized, deserializationRoot, document)
        if (!range) throw new Error('Failed to deserialize range')

        // 校验：文本相似度需 > 95%
        const rangeText = range.toString().trim()
        if (calculateSimilarity(rangeText, mark.text.trim()) < 95) {
          throw new Error('Content mismatch at path')
        }

        // 校验：上下文完整性 (可选)
        if (mark.surroundingSnippet) {
          const currentContext = getHighlightContext(range)
          if (calculateSimilarity(currentContext.surroundingSnippet, mark.surroundingSnippet) < 80) {
            throw new Error('Context integrity mismatch')
          }
        }

        applier.applyToRange(range)
        this.markAsRestored(mark.id)
        
      } catch (error) {
        // --- Level 2 & 3: 搜索算法 ---
        await this.handleSearchRecovery(mark, deserializationRoot, applier)
      }
    }

    // 触发 Level 4: 歧义处理 UI
    if (this.state.ambiguousMarks.length > 0) {
      this.actions.onAmbiguity(this.state.ambiguousMarks)
    }
  }

  /**
   * 处理搜索逻辑：精确/模糊匹配标记位置
   */
  private async handleSearchRecovery(mark: Mark, root: Node | undefined, applier: rangy.RangyClassApplier) {
    const searchRoot = root || document.documentElement
    let { ambiguityLevel, candidates } = findCandidateElements(mark, searchRoot, 10)

    // 如果局部 Shadow DOM 找不到，尝试全局查找
    if (candidates.length === 0 && searchRoot !== document.documentElement) {
      const globalResult = findCandidateElements(mark, document.documentElement, 10)
      ambiguityLevel = globalResult.ambiguityLevel
      candidates = globalResult.candidates
    }

    if (ambiguityLevel === 'unique' && candidates.length === 1) {
      const candidate = candidates[0]
      const similarity = mark.surroundingSnippet ? calculateSimilarity(candidate.displayContext, mark.surroundingSnippet) : 100

      // 高置信度匹配：自动应用并静默更新数据
      if (similarity >= 75) {
        const rangeResult = Highlighter.applyPreciseHighlight(candidate.candidateElement, candidate.displayTextSnippet, applier, candidate.matchIndex)
        if (rangeResult) {
          this.markAsRestored(mark.id)
          await this.updateMarkDetailsAfterRelocation(mark, rangeResult.range, candidate.candidateElement)
        } else {
          this.pushToAmbiguityQueue(mark.id, candidate)
        }
      } else {
        this.pushToAmbiguityQueue(mark.id, candidate)
      }
    } else if (ambiguityLevel === 'multiple') {
      // 存在多个候选项：推入歧义队列
      this.state.ambiguousMarks = [...this.state.ambiguousMarks.filter(m => m.originalMarkId !== mark.id), ...candidates]
    } else {
      // 彻底找不到：设置重试冷却
      this.failedRestoreCooldowns.set(mark.id, Date.now() + 3000)
    }
  }

  /**
   * 位置漂移后同步更新数据库中的路径信息
   */
  private async updateMarkDetailsAfterRelocation(mark: Mark, range: rangy.RangyRange, candidateElement: HTMLElement) {
    const root = candidateElement.getRootNode()
    const newSerialized = (rangy as any).serializeRange(range, true, root instanceof ShadowRoot ? root : undefined)
    const context = getHighlightContext(range)
    
    // 生成新的宿主链选择器
    let shadowHostSelector: string | undefined
    if (root instanceof ShadowRoot) {
      const chain: string[] = []
      let current: Node = root
      while (current instanceof ShadowRoot) {
        chain.unshift(getElementSelector(current.host))
        current = current.host.getRootNode()
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
      text: range.toString(),
      html: actualHtml,
      rangySerialized: newSerialized,
      shadowHostSelector: shadowHostSelector || null,
      ...context
    } as any, 'background')
  }

  private resolveDeserializationRoot(selector?: string): Node | undefined {
    if (!selector) return undefined
    
    if (selector.includes('|>>>|')) {
      const chain = selector.split('|>>>|')
      let currentRoot: Document | ShadowRoot = document
      let hostElement: Element | null = null
      for (const stepSelector of chain) {
        hostElement = currentRoot.querySelector(stepSelector)
        if (hostElement && hostElement.shadowRoot) currentRoot = hostElement.shadowRoot
        else return undefined
      }
      return hostElement?.shadowRoot || undefined
    }
    
    const element = querySelectorDeep(selector)
    return (element && element.shadowRoot) ? element.shadowRoot : undefined
  }

  private markAsRestored(markId: string) {
    this.restoredMarkIds.add(markId)
    this.failedRestoreCooldowns.delete(markId)
  }

  private pushToAmbiguityQueue(markId: string, candidate: any) {
    this.state.ambiguousMarks = [...this.state.ambiguousMarks.filter(m => m.originalMarkId !== markId), candidate]
  }

  clearRestoredMarkIds() {
    this.restoredMarkIds.clear()
  }
}
