/**
 * # 标记搜索算法 (Mark Search Algorithm)
 *
 * 本模块实现了网页标记的模糊搜索与恢复机制。
 * 核心架构：采用策略模式 (Strategy Pattern)，将不同的匹配算法解耦。
 * 核心原则：基于多维锚点共识 (Multi-Anchor Consensus) 的聚类搜索 + 局部对齐。
 */

import type { Mark } from './storage'
import { calculateSimilarity, findCommonAncestor, getAllTextNodes } from './dom'

/**
 * 搜索算法阈值配置 (Search Thresholds)
 */
const SEARCH_CONFIG = {
  MIN_SIMILARITY_AUTO_RESTORE: 75, // 自动恢复的最低相似度门槛
  AUTO_RESTORE_MIN_SCORE: 95, // “绝对胜出者”的最低分数
  AUTO_RESTORE_SCORE_MARGIN: 20, // 胜出者领先第二名的最小分差
  DEFAULT_LOOK_RANGE: 80, // 模糊搜索时的默认探测范围
  MIN_REGEX_LENGTH: 5, // 启用正则匹配的最小文本长度
  ANCHOR_SIZE: 12, // 锚点指纹大小
  ANCHOR_COUNT: 6, // 锚点数量
  CONSENSUS_CLUSTER_SIZE: 60, // 共识簇的物理范围 (字符)
}

/**
 * 搜索匹配候选项
 */
export interface Candidate {
  id: string
  originalMarkId: string
  originalMarkText: string
  candidateElement: HTMLElement
  displayTitle?: string
  displayTextSnippet: string
  displayContext: string
  similarityScore?: number
  matchIndex: number
  matchLength: number
}

/**
 * 歧义级别
 */
export type AmbiguityLevel = 'none' | 'unique' | 'multiple'

/**
 * 搜索上下文：封装共享搜索数据，避免重复计算
 */
export interface SearchContext {
  root: Node
  textNodes: Text[]
  fullText: string
  structureBoundaries: { index: number, end: number, text: string }[]
  /** 累积偏移量索引：用于 O(log N) 快速定位 TextNode */
  cumulativeOffsets: number[]
}

/**
 * 搜索策略接口
 */
export interface SearchStrategy {
  readonly name: string
  execute(mark: Mark, context: SearchContext): Candidate[]
}

// --- 具体策略实现 (Concrete Strategies) ---

/**
 * [Level 2] 精确匹配策略 (Exact Match)
 * 寻找内容完全一致的字符串。
 */
class ExactMatchStrategy implements SearchStrategy {
  readonly name = 'ExactMatch'

  execute(mark: Mark, context: SearchContext): Candidate[] {
    const { fullText } = context
    const candidates: Candidate[] = []
    let mIdx = fullText.indexOf(mark.text)

    while (mIdx !== -1) {
      const candidate = createCandidate(mark, mIdx, mark.text.length, context)
      if (candidate) {
        candidate.similarityScore = 100
        candidates.push(candidate)
      }
      mIdx = fullText.indexOf(mark.text, mIdx + 1)
    }
    return candidates
  }
}

/**
 * [Level 2.5] 正则模糊匹配策略 (Regex Match)
 * 处理空白符不敏感、零宽字符等场景。
 */
class RegexMatchStrategy implements SearchStrategy {
  readonly name = 'RegexMatch'

  execute(mark: Mark, context: SearchContext): Candidate[] {
    const { fullText } = context
    const normalize = (s: string) => s.replace(/[\s\u200b]+/g, ' ').trim()
    const nMark = normalize(mark.text)

    if (nMark.length <= SEARCH_CONFIG.MIN_REGEX_LENGTH)
      return []

    const candidates: Candidate[] = []
    // 使用正则进行模糊空白匹配，允许零宽字符和任意空白序列
    const regexSource = nMark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\u200b]*')

    try {
      const regex = new RegExp(regexSource, 'g')
      let match
      // eslint-disable-next-line no-cond-assign
      while ((match = regex.exec(fullText)) !== null) {
        const candidate = createCandidate(mark, match.index, match[0].length, context)
        if (candidate) {
          candidate.similarityScore = 98
          candidates.push(candidate)
        }
        if (candidates.length > 10)
          break
      }
    }
    catch (e) {
      console.warn('[WebMarker-Search] Regex fallback failed:', e)
    }
    return candidates
  }
}

/**
 * [Level 3] 共识锚点匹配策略 (Consensus Match)
 * 用于文档结构发生较大变化时的恢复。
 */
class ConsensusMatchStrategy implements SearchStrategy {
  readonly name = 'ConsensusMatch'

  execute(mark: Mark, context: SearchContext): Candidate[] {
    if (!mark.surroundingSnippet)
      return []

    // 1. 获取锚点共识推荐的起始点
    const anchorManager = new ConsensusAnchorManager(mark.surroundingSnippet, mark.text)
    const suggestedStart = anchorManager.suggestStartPoint(context.fullText)

    if (suggestedStart === -1)
      return []

    // 2. 局部对齐精细校准边界
    const aligner = new LocalAligner(mark.text, context)
    const alignedRange = aligner.refineBoundary(suggestedStart)

    if (alignedRange.score > 40) {
      const actualText = context.fullText.substring(alignedRange.start, alignedRange.end)
      const candidate = createCandidate(mark, alignedRange.start, alignedRange.end - alignedRange.start, context)
      if (candidate) {
        candidate.similarityScore = alignedRange.score
        candidate.displayTextSnippet = actualText
        console.log(`[WebMarker-Search] L3 Consensus Candidate: "${actualText.substring(0, 30)}..." (Sim: ${alignedRange.score.toFixed(1)}%)`)
        return [candidate]
      }
    }

    return []
  }
}

// --- 算法原子组件 (Atomic Components) ---

/**
 * 负责锚点指纹的提取与定位
 */
class ConsensusAnchorManager {
  constructor(private snippet: string, private markText: string) {}

  /**
   * 通过多锚点投票建议一个可能的起始索引
   */
  suggestStartPoint(fullText: string): number {
    const markStartInSnippet = this.calculateExpectedOffset()
    const anchors = this.extractAnchors()
    const estimates = this.locateAnchors(anchors, fullText, markStartInSnippet)

    return this.findConsensusCluster(estimates)
  }

  private calculateExpectedOffset(): number {
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
    const markStart = this.snippet.indexOf(this.markText)
    if (markStart !== -1)
      return markStart

    const nSnippet = norm(this.snippet)
    const nIdx = nSnippet.indexOf(norm(this.markText))
    return nIdx !== -1 ? Math.floor((nIdx / nSnippet.length) * this.snippet.length) : Math.floor((this.snippet.length - this.markText.length) / 2)
  }

  private extractAnchors(): { text: string, offset: number }[] {
    const { ANCHOR_SIZE, ANCHOR_COUNT } = SEARCH_CONFIG
    const anchors = []
    for (let i = 0; i < ANCHOR_COUNT; i++) {
      const pos = Math.floor((this.snippet.length - ANCHOR_SIZE) * (i / (ANCHOR_COUNT - 1)))
      const txt = this.snippet.substring(pos, pos + ANCHOR_SIZE)
      if (txt.trim().length >= 4)
        anchors.push({ text: txt, offset: pos })
    }
    return anchors
  }

  private locateAnchors(anchors: { text: string, offset: number }[], fullText: string, markStartInSnippet: number): number[] {
    const suggestedStarts: number[] = []
    for (const anchor of anchors) {
      let bestS = 0, bestI = -1
      for (let j = 0; j < fullText.length - anchor.text.length; j += 2) {
        const score = calculateSimilarity(fullText.substring(j, j + anchor.text.length), anchor.text)
        if (score > bestS) { bestS = score; bestI = j }
        if (score === 100)
          break
      }
      if (bestS > 70)
        suggestedStarts.push(bestI - anchor.offset + markStartInSnippet)
    }
    return suggestedStarts
  }

  private findConsensusCluster(estimates: number[]): number {
    let bestStart = -1
    let maxCount = 0
    estimates.forEach((e1) => {
      const count = estimates.filter(e2 => Math.abs(e1 - e2) < SEARCH_CONFIG.CONSENSUS_CLUSTER_SIZE).length
      if (count > maxCount) {
        maxCount = count
        bestStart = e1
      }
    })
    return bestStart
  }
}

/**
 * 负责局部边界的对齐校准
 */
class LocalAligner {
  constructor(private markText: string, private context: SearchContext) {}

  refineBoundary(suggestedStart: number): { start: number, end: number, score: number } {
    const { fullText, structureBoundaries } = this.context
    let bestSim = 0
    let finalStart = suggestedStart
    let finalEnd = suggestedStart + this.markText.length

    // 弹性探测范围：基于文本长度动态缩放
    const lookRange = Math.max(SEARCH_CONFIG.DEFAULT_LOOK_RANGE, this.markText.length * 0.5)
    
    const startBase = Math.max(0, suggestedStart - lookRange)
    const startMax = Math.min(fullText.length, suggestedStart + lookRange)

    for (let i = startBase; i < startMax; i++) {
      if (structureBoundaries.some(b => i >= b.index && i < b.end))
        continue

      const jMin = i + Math.min(5, this.markText.length * 0.1)
      const jMax = Math.min(fullText.length, i + this.markText.length + lookRange)

      for (let j = jMin; j < jMax; j++) {
        if (structureBoundaries.some(b => b.index > i && b.index < j && !this.markText.includes(b.text)))
          break

        const sub = fullText.substring(i, j)
        const sim = calculateSimilarity(sub, this.markText)
        const lengthRatio = Math.min(sub.length, this.markText.length) / Math.max(sub.length, this.markText.length)
        const weightedSim = sim * (0.8 + 0.2 * lengthRatio)

        if (weightedSim > bestSim) {
          bestSim = weightedSim
          finalStart = i
          finalEnd = j
        }
        if (sim === 100 && lengthRatio > 0.95)
          break
      }
      if (bestSim > 98)
        break
    }

    return { start: finalStart, end: finalEnd, score: bestSim }
  }
}

// --- 搜索引擎调度器 (Search Engine Coordinator) ---

/**
 * 执行搜索调度逻辑
 */
export function findCandidateElements(
  mark: Mark,
  searchRoot: Node,
  _contextExtractionLength: number = 10,
): { ambiguityLevel: AmbiguityLevel, candidates: Candidate[] } {
  console.log(`[WebMarker-Search] Starting generic search for ID: ${mark.id}`)

  // 1. 初始化上下文 (Context Creation)
  const context = createSearchContext(searchRoot)

  // 2. 注入并按优先级执行策略 (Strategy Execution)
  const strategies: SearchStrategy[] = [
    new ExactMatchStrategy(),
    new RegexMatchStrategy(),
    new ConsensusMatchStrategy(),
  ]

  let candidates: Candidate[] = []
  for (const strategy of strategies) {
    const results = strategy.execute(mark, context)
    if (results.length > 0) {
      candidates = results
      // 如果已找到高置信度的精确匹配，尽早返回 (Early Return)
      if (strategy.name === 'ExactMatch')
        break
    }
  }

  // 3. 后处理：去重与排序 (Post-processing)
  const uniqueCandidates = Array.from(new Map(candidates.map(c => [`${c.candidateElement.innerHTML}-${c.matchIndex}`, c])).values())
  uniqueCandidates.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))

  // 4. 计算歧义级别 (Ambiguity & Level 4 Decision)
  return resolveAmbiguity(uniqueCandidates)
}

/**
 * [Level 4 Trigger Logic]
 * 决定最终的歧义级别，这直接决定了前端是否弹出 Level 4 歧义消除 UI。
 */
function resolveAmbiguity(candidates: Candidate[]): { ambiguityLevel: AmbiguityLevel, candidates: Candidate[] } {
  if (candidates.length === 0) {
    // [Trigger Level 4] 完全找不到匹配，用户可能需要手动重选
    return { ambiguityLevel: 'none', candidates: [] }
  }

  if (candidates.length === 1) {
    // [Trigger Level 4 if score < 75] 
    // 虽然唯一，但置信度过低，仍视为有歧义，交由用户进行“物理校准”。
    const isHighConfidence = (candidates[0].similarityScore || 0) >= SEARCH_CONFIG.MIN_SIMILARITY_AUTO_RESTORE
    return { 
      ambiguityLevel: isHighConfidence ? 'unique' : 'multiple', 
      candidates 
    }
  }

  // [Multiple candidates detected]
  const [best, second] = candidates
  const bestScore = best.similarityScore || 0
  const secondScore = second.similarityScore || 0
  
  // 如果第一名远超第二名，且第一名置信度极高，则自动恢复
  const hasClearWinner = bestScore >= SEARCH_CONFIG.AUTO_RESTORE_MIN_SCORE && (bestScore - secondScore) > SEARCH_CONFIG.AUTO_RESTORE_SCORE_MARGIN

  return {
    // [Trigger Level 4 if no clear winner]
    ambiguityLevel: hasClearWinner ? 'unique' : 'multiple',
    candidates,
  }
}

// --- 内部工具函数 (Internal Utilities) ---

function createSearchContext(searchRoot: Node): SearchContext {
  const textNodes = getAllTextNodes(searchRoot)
  const fullText = textNodes.map(n => n.textContent || '').join('')
  const cumulativeOffsets: number[] = []
  let currentOffset = 0
  
  for (const node of textNodes) {
    cumulativeOffsets.push(currentOffset)
    currentOffset += (node.textContent || '').length
  }
  // 哨兵值
  cumulativeOffsets.push(currentOffset)

  const structureBoundaries: { index: number, end: number, text: string }[] = []
  if (searchRoot instanceof HTMLElement || searchRoot instanceof ShadowRoot) {
    const headers = (searchRoot as HTMLElement).querySelectorAll('h1, h2, h3, h4, h5, h6')
    headers.forEach((h) => {
      const txt = h.textContent?.trim()
      if (txt && txt.length > 2) {
        const idx = fullText.indexOf(txt)
        if (idx !== -1)
          structureBoundaries.push({ index: idx, end: idx + txt.length, text: txt })
      }
    })
  }
  return { root: searchRoot, textNodes, fullText, structureBoundaries, cumulativeOffsets }
}

function findNearestBlockContainer(node: Node): HTMLElement | null {
  let current = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
  while (current) {
    const style = window.getComputedStyle(current)
    if (['block', 'list-item', 'flex', 'grid'].includes(style.display) || style.display.startsWith('table')) {
      return current
    }
    current = current.parentElement
  }
  return null
}

/**
 * 使用二分查找在 O(log N) 时间内定位索引所属的 TextNode 索引
 */
function findTextNodeIndex(charIndex: number, cumulativeOffsets: number[]): number {
  let low = 0
  let high = cumulativeOffsets.length - 2
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (charIndex >= cumulativeOffsets[mid] && charIndex < cumulativeOffsets[mid + 1])
      return mid
    if (charIndex < cumulativeOffsets[mid])
      high = mid - 1
    else
      low = mid + 1
  }
  return -1
}

function createCandidate(mark: Mark, matchIndex: number, matchLength: number, context: SearchContext): Candidate | null {
  if (matchIndex < 0)
    return null
    
  const { textNodes, fullText, cumulativeOffsets } = context
  const matchEnd = matchIndex + matchLength

  // [性能优化] 使用二分查找定位起始和结束节点索引
  const startNodeIdx = findTextNodeIndex(matchIndex, cumulativeOffsets)
  const endNodeIdx = findTextNodeIndex(matchEnd - 1, cumulativeOffsets)

  if (startNodeIdx === -1 || endNodeIdx === -1)
    return null

  const involvedNodes = textNodes.slice(startNodeIdx, endNodeIdx + 1)
  if (involvedNodes.length === 0)
    return null

  const lca = findCommonAncestor(involvedNodes)
  const lcaStartPos = cumulativeOffsets[startNodeIdx] // 精确的 LCA 起始位置计算简化

  const contextLength = 25
  const start = Math.max(0, matchIndex - contextLength)
  const end = Math.min(fullText.length, matchEnd + contextLength)
  const surroundingSnippet = fullText.substring(start, end)

  const blockContainer = findNearestBlockContainer(involvedNodes[0])
  let richContext = blockContainer ? (blockContainer.textContent?.trim() || '') : surroundingSnippet
  if (richContext.length < matchLength)
    richContext = surroundingSnippet

  return {
    id: `${mark.id}-${matchIndex}-${Math.random().toString(36).substring(2, 7)}`,
    originalMarkId: mark.id,
    originalMarkText: mark.text,
    candidateElement: lca,
    displayTitle: mark.contextTitle,
    displayTextSnippet: fullText.substring(matchIndex, matchEnd),
    displayContext: richContext,
    matchIndex: matchIndex - lcaStartPos,
    matchLength,
  }
}
