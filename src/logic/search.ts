/**
 * # 标记搜索 algorithm (Mark Search Algorithm)
 *
 * 本模块实现了网页标记的模糊搜索与恢复机制。
 */

import type { Mark } from './storage'
import { calculateSimilarity, findCommonAncestor, getAllTextNodes } from './dom'

/**
 * 搜索算法阈值配置
 */
const SEARCH_CONFIG = {
  MIN_SIMILARITY_AUTO_RESTORE: 85, // 提高自动恢复门槛
  AUTO_RESTORE_MIN_SCORE: 95,
  AUTO_RESTORE_SCORE_MARGIN: 20,
  MIN_DISAMBIGUATION_SCORE: 45, // 相似度低于此值的候选者将被忽略，防止“幽灵弹窗”
  DEFAULT_LOOK_RANGE: 150,
  MIN_REGEX_LENGTH: 5,
  ANCHOR_SIZE: 8, 
  ANCHOR_COUNT: 24, // 增加锚点数量覆盖长选区
  CONSENSUS_CLUSTER_SIZE: 50,
}

export interface Candidate {
  id: string
  originalMarkId: string
  originalMarkText: string
  candidateElement: HTMLElement
  displayTitle?: string
  displayTextSnippet: string
  displayContext: string
  surroundingSnippet: string
  similarityScore?: number
  contextScore?: number // 新增：上下文匹配得分，用于区分重复文字
  matchIndex: number
  matchLength: number
}

export type AmbiguityLevel = 'none' | 'unique' | 'multiple'

export interface SearchContext {
  root: Node
  textNodes: Text[]
  fullText: string
  structureBoundaries: { index: number, end: number, text: string, type: string }[]
  cumulativeOffsets: number[]
}

export interface SearchStrategy {
  readonly name: string
  execute(mark: Mark, context: SearchContext): Candidate[]
}

// --- Strategies ---

class ExactMatchStrategy implements SearchStrategy {
  readonly name = 'ExactMatch'
  execute(mark: Mark, context: SearchContext): Candidate[] {
    const { fullText } = context
    const candidates: Candidate[] = []
    let mIdx = fullText.indexOf(mark.text)
    while (mIdx !== -1) {
      const candidate = createCandidate(mark, mIdx, mark.text.length, context)
      if (candidate) { candidate.similarityScore = 100; candidates.push(candidate) }
      mIdx = fullText.indexOf(mark.text, mIdx + 1)
    }
    return candidates
  }
}

class RegexMatchStrategy implements SearchStrategy {
  readonly name = 'RegexMatch'
  execute(mark: Mark, context: SearchContext): Candidate[] {
    const { fullText } = context
    const normalize = (s: string) => s.replace(/[\s\u200b]+/g, ' ').trim()
    const nMark = normalize(mark.text)
    if (nMark.length <= SEARCH_CONFIG.MIN_REGEX_LENGTH) return []
    const candidates: Candidate[] = []
    const regexSource = nMark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\u200b]*')
    try {
      const regex = new RegExp(regexSource, 'g')
      let match
      while ((match = regex.exec(fullText)) !== null) {
        const candidate = createCandidate(mark, match.index, match[0].length, context)
        if (candidate) { candidate.similarityScore = 98; candidates.push(candidate) }
        if (candidates.length > 10) break
      }
    } catch (e) {}
    return candidates
  }
}

class ConsensusMatchStrategy implements SearchStrategy {
  readonly name = 'ConsensusMatch'
  execute(mark: Mark, context: SearchContext): Candidate[] {
    if (!mark.surroundingSnippet) return []
    const anchorManager = new ConsensusAnchorManager(mark.surroundingSnippet, mark.text)
    const suggestedRange = anchorManager.suggestRange(context.fullText)
    if (!suggestedRange) return []

    const aligner = new LocalAligner(mark.text, context)
    const alignedRange = aligner.refineBoundary(suggestedRange.start, suggestedRange.end)

    // 核心优化：如果模糊匹配分数过低，直接放弃该候选者，避免干扰歧义判断
    const actualText = context.fullText.substring(alignedRange.start, alignedRange.end)
    if (alignedRange.score < SEARCH_CONFIG.MIN_DISAMBIGUATION_SCORE) {
      console.log(`[WebMarker-Search] L3 Match rejected: score too low (${alignedRange.score.toFixed(1)}%)`)
      return []
    }

    const candidate = createCandidate(mark, alignedRange.start, alignedRange.end - alignedRange.start, context)
    if (candidate) {
      candidate.similarityScore = alignedRange.score
      candidate.displayTextSnippet = actualText
      console.log(`[WebMarker-Search] L3 Match: "${actualText.substring(0, 30)}..." (Sim: ${alignedRange.score.toFixed(1)}%)`)
      return [candidate]
    }
    return []
  }
}

// --- Components ---

class ConsensusAnchorManager {
  private markStartInSnippet: number
  constructor(private snippet: string, private markText: string) {
    this.markStartInSnippet = this.calculateMarkStartInSnippet()
  }

  suggestRange(fullText: string): { start: number, end: number } | null {
    const anchors = this.extractAnchors()
    const startVotes: { val: number, weight: number }[] = []
    const endVotes: { val: number, weight: number }[] = []
    const markEndInSnippet = this.markStartInSnippet + this.markText.length

    for (const anchor of anchors) {
      const matches = this.findBestMatches(anchor.text, fullText)
      for (const mIdx of matches) {
        startVotes.push({ val: mIdx - anchor.relStart, weight: anchor.weight })
        endVotes.push({ val: mIdx - anchor.relEnd, weight: anchor.weight })
      }
    }
    
    const bestStart = this.findBestCluster(startVotes)
    const bestEnd = this.findBestCluster(endVotes)

    if (bestStart !== null && bestEnd !== null && bestEnd > bestStart) {
      return { start: bestStart, end: bestEnd }
    }
    return bestStart !== null ? { start: bestStart, end: bestStart + this.markText.length } : null
  }

  private findBestCluster(votes: { val: number, weight: number }[]): number | null {
    if (votes.length === 0) return null
    votes.sort((a, b) => a.val - b.val)
    let maxWeight = 0, bestVal = votes[0].val
    for (let i = 0; i < votes.length; i++) {
      let weight = 0, j = i
      while (j < votes.length && votes[j].val - votes[i].val <= SEARCH_CONFIG.CONSENSUS_CLUSTER_SIZE) {
        weight += votes[j].weight; j++
      }
      if (weight > maxWeight) {
        maxWeight = weight
        const cluster = votes.slice(i, j)
        bestVal = cluster.sort((a, b) => b.weight - a.weight)[0].val
      }
    }
    return maxWeight >= 2 ? bestVal : null
  }

  private calculateMarkStartInSnippet(): number {
    const idx = this.snippet.indexOf(this.markText)
    if (idx !== -1) return idx
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
    const nIdx = norm(this.snippet).indexOf(norm(this.markText))
    return nIdx !== -1 ? Math.floor((nIdx / norm(this.snippet).length) * this.snippet.length) : Math.floor((this.snippet.length - this.markText.length) / 2)
  }

  private extractAnchors() {
    const { ANCHOR_SIZE, ANCHOR_COUNT } = SEARCH_CONFIG
    const anchors = []
    const markEndInSnippet = this.markStartInSnippet + this.markText.length
    for (let i = 0; i < ANCHOR_COUNT; i++) {
      const pos = Math.floor((this.snippet.length - ANCHOR_SIZE) * (i / (ANCHOR_COUNT - 1)))
      const txt = this.snippet.substring(pos, pos + ANCHOR_SIZE)
      if (txt.trim().length >= 3) {
        const isInternal = pos >= this.markStartInSnippet && (pos + ANCHOR_SIZE) <= markEndInSnippet
        anchors.push({ 
          text: txt, 
          relStart: pos - this.markStartInSnippet,
          relEnd: pos - markEndInSnippet,
          weight: isInternal ? 20 : 1 
        })
      }
    }
    return anchors
  }

  private findBestMatches(target: string, fullText: string): number[] {
    const matches: number[] = []
    const source = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
    try {
      const regex = new RegExp(source, 'g')
      let m; while ((m = regex.exec(fullText)) !== null && matches.length < 5) matches.push(m.index)
    } catch (e) {}
    return matches
  }
}

class LocalAligner {
  constructor(private markText: string, private context: SearchContext) {}
  refineBoundary(suggestedStart: number, suggestedEnd: number): { start: number, end: number, score: number } {
    const { fullText, structureBoundaries } = this.context
    let bestSim = 0, finalStart = Math.max(0, suggestedStart), finalEnd = Math.max(0, suggestedEnd)
    
    const startMin = Math.max(0, suggestedStart - 40), startMax = Math.min(fullText.length, suggestedStart + 40)
    const endMin = Math.max(finalStart + 1, suggestedEnd - 40), endMax = Math.min(fullText.length, suggestedEnd + 40)

    for (let i = startMin; i < startMax; i++) {
      // 检查起始点是否跨越了原本不该跨越的结构边界
      if (structureBoundaries.some(b => i > b.index && i < b.end && !this.markText.includes(b.text))) continue
      
      for (let j = endMin; j < endMax; j++) {
        const sub = fullText.substring(i, j)
        
        // 核心约束：如果原本标记中不包含特定的块级标签内容，则不应跨越新出现的块级边界
        const crossesBoundary = structureBoundaries.some(b => b.index > i && b.index < j && !this.markText.includes(b.text))
        if (crossesBoundary) continue

        const sim = calculateSimilarity(sub, this.markText)
        const lengthRatio = Math.min(sub.length, this.markText.length) / Math.max(sub.length, this.markText.length)
        const weightedSim = sim * (0.8 + 0.2 * lengthRatio)
        
        if (weightedSim > bestSim) { bestSim = weightedSim; finalStart = i; finalEnd = j }
        if (sim === 100 && lengthRatio > 0.98) break
      }
      if (bestSim > 99) break
    }
    // Trim
    while (finalStart < finalEnd && /\s/.test(fullText[finalStart]) && !/\s/.test(this.markText[0] || '')) finalStart++
    while (finalEnd > finalStart && /\s/.test(fullText[finalEnd - 1]) && !/\s/.test(this.markText[this.markText.length - 1] || '')) finalEnd--
    return { start: finalStart, end: finalEnd, score: bestSim }
  }
}

// --- Dispatcher & Utils ---

export function findCandidateElements(mark: Mark, searchRoot: Node, _extLen: number = 10): { ambiguityLevel: AmbiguityLevel, candidates: Candidate[] } {
  console.log(`[WebMarker-Search] Searching ID: ${mark.id}`)
  const context = createSearchContext(searchRoot)
  const strategies: SearchStrategy[] = [new ExactMatchStrategy(), new RegexMatchStrategy(), new ConsensusMatchStrategy()]
  let candidates: Candidate[] = []
  for (const strategy of strategies) {
    const results = strategy.execute(mark, context)
    if (results.length > 0) {
      if (strategy.name === 'ExactMatch') {
        // ExactMatch 结果可直接信任，提前终止
        candidates = results
        break
      }
      // 非精确匹配策略累积结果，后续统一去重和排序选择最佳
      candidates.push(...results)
    }
  }
  const uniqueCandidates = Array.from(new Map(candidates.map(c => [`${c.candidateElement.innerHTML}-${c.matchIndex}`, c])).values())
  uniqueCandidates.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))
  return resolveAmbiguity(uniqueCandidates)
}

function resolveAmbiguity(candidates: Candidate[]): { ambiguityLevel: AmbiguityLevel, candidates: Candidate[] } {
  // 核心修复：过滤掉相似度过低的“垃圾匹配”，避免在内容未加载时弹出确认框
  const validCandidates = candidates.filter(c => (c.similarityScore || 0) >= SEARCH_CONFIG.MIN_DISAMBIGUATION_SCORE)

  if (validCandidates.length === 0) return { ambiguityLevel: 'none', candidates: [] }

  // [上下文优选逻辑] 即使有多个文本相同的项，通过上下文匹配度来打破僵局
  if (validCandidates.length > 1) {
    const sortedByContext = [...validCandidates].sort((a, b) => (b.contextScore || 0) - (a.contextScore || 0))
    const best = sortedByContext[0]
    const second = sortedByContext[1]

    // 如果第一名的上下文匹配度极高（>85%），且显著高于第二名（领先20分以上），则自动胜出
    if ((best.contextScore || 0) > 85 && ((best.contextScore || 0) - (second.contextScore || 0) > 20)) {
       console.log(`[WebMarker-Search] Context-based tie-break success. Winner Score: ${best.contextScore}%`)
       return { ambiguityLevel: 'unique', candidates: [best] }
    }
  }
  
  if (validCandidates.length === 1) {
    const isHighConf = (validCandidates[0].similarityScore || 0) >= SEARCH_CONFIG.MIN_SIMILARITY_AUTO_RESTORE
    return { ambiguityLevel: isHighConf ? 'unique' : 'multiple', candidates: validCandidates }
  }

  const [best, second] = validCandidates
  const bestScore = best.similarityScore || 0, secondScore = second.similarityScore || 0
  const hasClearWinner = bestScore >= SEARCH_CONFIG.AUTO_RESTORE_MIN_SCORE && (bestScore - secondScore) > SEARCH_CONFIG.AUTO_RESTORE_SCORE_MARGIN
  return { ambiguityLevel: hasClearWinner ? 'unique' : 'multiple', candidates: validCandidates }
}

function createSearchContext(searchRoot: Node): SearchContext {
  const textNodes = getAllTextNodes(searchRoot)
  const fullText = textNodes.map(n => n.textContent || '').join('')
  const cumulativeOffsets: number[] = []
  let currentOffset = 0
  for (const node of textNodes) { cumulativeOffsets.push(currentOffset); currentOffset += (node.textContent || '').length }
  cumulativeOffsets.push(currentOffset)
  const structureBoundaries: { index: number, end: number, text: string, type: string }[] = []
  if (searchRoot instanceof HTMLElement || searchRoot instanceof ShadowRoot) {
    const elements = (searchRoot as HTMLElement).querySelectorAll('h1, h2, h3, h4, h5, h6, div, p, li, section, article')
    elements.forEach((el) => {
      const txt = el.textContent?.trim()
      if (txt && txt.length > 2) {
        const elNodes = getAllTextNodes(el)
        if (elNodes.length > 0) {
          const first = textNodes.indexOf(elNodes[0]), last = textNodes.indexOf(elNodes[elNodes.length - 1])
          if (first !== -1 && last !== -1) structureBoundaries.push({ index: cumulativeOffsets[first], end: cumulativeOffsets[last + 1], text: txt.substring(0, 20), type: el.tagName })
        }
      }
    })
  }
  return { root: searchRoot, textNodes, fullText, structureBoundaries, cumulativeOffsets }
}

function findNearestBlockContainer(node: Node): HTMLElement | null {
  let current = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
  while (current) {
    const style = window.getComputedStyle(current)
    if (['block', 'list-item', 'flex', 'grid'].includes(style.display) || style.display.startsWith('table')) return current
    current = current.parentElement
  }
  return null
}

function findTextNodeIndex(charIndex: number, cumulativeOffsets: number[]): number {
  let low = 0, high = cumulativeOffsets.length - 2
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (charIndex >= cumulativeOffsets[mid] && charIndex < cumulativeOffsets[mid + 1]) return mid
    if (charIndex < cumulativeOffsets[mid]) high = mid - 1; else low = mid + 1
  }
  return -1
}

function createCandidate(mark: Mark, matchIndex: number, matchLength: number, context: SearchContext): Candidate | null {
  const clampedIdx = Math.max(0, matchIndex)
  const { textNodes, fullText, cumulativeOffsets } = context
  const matchEnd = clampedIdx + matchLength
  const startNodeIdx = findTextNodeIndex(clampedIdx, cumulativeOffsets), endNodeIdx = findTextNodeIndex(matchEnd - 1, cumulativeOffsets)
  if (startNodeIdx === -1 || endNodeIdx === -1) return null
  const involvedNodes = textNodes.slice(startNodeIdx, endNodeIdx + 1)
  if (involvedNodes.length === 0) return null
  const lca = findCommonAncestor(involvedNodes)
  const lcaTextNodes = getAllTextNodes(lca)
  const firstTextNodeOfLca = lcaTextNodes[0]
  const firstTextNodeIdxInGlobal = textNodes.indexOf(firstTextNodeOfLca)
  if (firstTextNodeIdxInGlobal === -1) return null
  const lcaStartPos = cumulativeOffsets[firstTextNodeIdxInGlobal]
  
  // 精准提取当前候选位置的物理上下文
  const contextLength = 25
  const start = Math.max(0, clampedIdx - contextLength), end = Math.min(fullText.length, matchEnd + contextLength)
  const surroundingSnippet = fullText.substring(start, end)
  
  // [核心修复] 计算此候选位置的上下文匹配得分
  const contextScore = mark.surroundingSnippet 
    ? calculateSimilarity(surroundingSnippet, mark.surroundingSnippet)
    : 0

  const blockContainer = findNearestBlockContainer(involvedNodes[0])
  let richContext = blockContainer ? (blockContainer.textContent?.trim() || '') : surroundingSnippet
  if (richContext.length < matchLength) richContext = surroundingSnippet
  return {
    id: `${mark.id}-${clampedIdx}-${Math.random().toString(36).substring(2, 7)}`,
    originalMarkId: mark.id, originalMarkText: mark.text, candidateElement: lca,
    displayTitle: mark.contextTitle, displayTextSnippet: fullText.substring(clampedIdx, matchEnd),
    displayContext: richContext, surroundingSnippet, matchIndex: clampedIdx - lcaStartPos, matchLength,
    contextScore,
  }
}
