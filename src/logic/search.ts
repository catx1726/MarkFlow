/**
 * # 标记搜索算法 (Mark Search Algorithm)
 *
 * 本模块实现了网页标记的模糊搜索与恢复机制。当 Level 1 路径还原失败时，
 * `findCandidateElements()` 被调用，通过两级搜索策略（L2 + L3）在页面中重新定位标记。
 *
 * ## 在四级恢复架构中的位置
 *
 * ```
 * Level 1: Rangy 反序列化 (contentScripts/index.ts)  ← 失败时调用本模块
 * Level 2: 精确匹配 (本模块)
 * Level 3: 夹逼搜索 (本模块)
 * Level 4: DisambiguationModal (contentScripts/index.ts)  ← 本模块输出歧义结果
 * ```
 */

import type { Mark } from './storage'
import { calculateSimilarity, findCommonAncestor, getAllTextNodes } from './dom'

export interface Candidate {
  id: string
  originalMarkId: string
  originalMarkText: string
  candidateElement: HTMLElement // 现在将是最小公共祖先 (LCA)
  displayTitle?: string
  displayTextSnippet: string
  displayContext: string
  similarityScore?: number
  matchIndex: number // 相对于 candidateElement 的本地起始偏移量
  matchLength: number // 匹配文本的长度
}

export type AmbiguityLevel = 'none' | 'unique' | 'multiple'

export function findCandidateElements(
  mark: Mark,
  searchRoot: Node,
  _contextExtractionLength: number = 10,
): { ambiguityLevel: AmbiguityLevel, candidates: Candidate[] } {
  console.log(`[WebMarker-Search] Starting logic-enhanced search for ID: ${mark.id}`)

  const textNodes = getAllTextNodes(searchRoot)
  const fullText = textNodes.map(n => n.textContent || '').join('')
  const candidates: Candidate[] = []

  // --- Level 2: Exact Match ---
  let matchIndex = fullText.indexOf(mark.text)
  while (matchIndex !== -1) {
    const candidate = createCandidate(mark, matchIndex, textNodes, fullText)
    if (candidate) {
      const similarity = mark.surroundingSnippet ? calculateSimilarity(candidate.displayContext, mark.surroundingSnippet) : 100
      candidate.similarityScore = similarity
      candidates.push(candidate)
    }
    matchIndex = fullText.indexOf(mark.text, matchIndex + 1)
  }

  // --- Level 3: Fuzzy Match (Context Anchoring / Sandwich Method) ---
  if (mark.surroundingSnippet) {
    console.log('[WebMarker-Search] Performing Level 3 Sandwich Search...')
    
    const prefix = mark.surroundingSnippet.substring(0, 20)
    const suffix = mark.surroundingSnippet.substring(mark.surroundingSnippet.length - 20)
    
    let bestPrefixScore = 0
    let bestPrefixIndex = -1
    let bestSuffixScore = 0
    let bestSuffixIndex = -1

    for (let i = 0; i < fullText.length - prefix.length; i++) {
      const score = calculateSimilarity(fullText.substring(i, i + prefix.length), prefix)
      if (score > bestPrefixScore) {
        bestPrefixScore = score
        bestPrefixIndex = i
      }
    }

    if (bestPrefixScore > 70) {
      const searchStart = bestPrefixIndex + prefix.length
      for (let i = searchStart; i < Math.min(fullText.length, searchStart + mark.text.length + 100); i++) {
        const score = calculateSimilarity(fullText.substring(i, i + suffix.length), suffix)
        if (score > bestSuffixScore) {
          bestSuffixScore = score
          bestSuffixIndex = i
        }
      }
    }

    if (bestPrefixScore > 70 && bestSuffixScore > 70 && bestSuffixIndex > bestPrefixIndex) {
      const start = bestPrefixIndex + prefix.length
      const end = bestSuffixIndex
      const actualText = fullText.substring(start, end).trim()
      
      const candidate = createCandidate(mark, start, textNodes, fullText)
      if (candidate) {
        candidate.similarityScore = (bestPrefixScore + bestSuffixScore) / 2
        candidate.displayTextSnippet = actualText || mark.text
        candidates.push(candidate)
      }
    }
  }

  candidates.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))
  const uniqueCandidates = Array.from(new Map(candidates.map(c => [c.candidateElement, c])).values())

  let ambiguityLevel: AmbiguityLevel = 'none'
  if (uniqueCandidates.length === 1) {
    if ((uniqueCandidates[0].similarityScore || 0) >= 85)
      ambiguityLevel = 'unique'
    else
      ambiguityLevel = 'multiple'
  }
  else if (uniqueCandidates.length > 1) {
    const best = uniqueCandidates[0]
    const second = uniqueCandidates[1]
    if ((best.similarityScore || 0) >= 98 && ((best.similarityScore || 0) - (second.similarityScore || 0)) > 15)
      ambiguityLevel = 'unique'
    else
      ambiguityLevel = 'multiple'
  }

  return { ambiguityLevel, candidates: uniqueCandidates }
}

function findNearestBlockContainer(node: Node): HTMLElement | null {
  let current = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement
  while (current) {
    const style = window.getComputedStyle(current)
    const display = style.display
    if (display === 'block' || display === 'list-item' || display.startsWith('table') || display === 'flex' || display === 'grid') {
      return current
    }
    current = current.parentElement
  }
  return null
}

function createCandidate(mark: Mark, matchIndex: number, textNodes: Text[], fullText: string): Candidate | null {
  if (matchIndex < 0)
    return null

  const matchEnd = matchIndex + mark.text.length
  const involvedNodes: Text[] = []
  let currentPos = 0

  for (const node of textNodes) {
    const len = (node.textContent || '').length
    const nodeEnd = currentPos + len
    if (nodeEnd > matchIndex && currentPos < matchEnd) {
      involvedNodes.push(node)
    }
    currentPos = nodeEnd
    if (currentPos >= matchEnd)
      break
  }

  if (involvedNodes.length === 0)
    return null

  const lca = findCommonAncestor(involvedNodes)

  let lcaStartPos = 0
  for (const node of textNodes) {
    if (lca.contains(node))
      break
    lcaStartPos += (node.textContent || '').length
  }
  const localMatchIndex = matchIndex - lcaStartPos

  const contextLength = 20
  const start = Math.max(0, matchIndex - contextLength)
  const end = Math.min(fullText.length, matchIndex + mark.text.length + contextLength)
  const surroundingSnippet = fullText.substring(start, end)

  const blockContainer = findNearestBlockContainer(involvedNodes[0])
  let richContext = blockContainer ? (blockContainer.textContent?.trim() || '') : surroundingSnippet
  
  // 如果找到的块容器文本比我们要找的文本还短（说明是跨块高亮），或者相似度可能很低
  // 则回退到使用周围片段作为 context，以确保相似度计算的稳健性
  if (richContext.length < mark.text.length) {
    richContext = surroundingSnippet
  }

  return {
    id: `${mark.id}-${matchIndex}-${Math.random().toString(36).substring(2, 7)}`,
    originalMarkId: mark.id,
    originalMarkText: mark.text,
    candidateElement: lca,
    displayTitle: mark.contextTitle,
    displayTextSnippet: fullText.substring(matchIndex, matchEnd),
    displayContext: richContext,
    matchIndex: localMatchIndex,
    matchLength: mark.text.length,
  }
}
