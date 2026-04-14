/**
 * # 标记搜索算法 (Mark Search Algorithm)
 *
 * 本模块实现了网页标记的模糊搜索与恢复机制。当 Level 1 路径还原失败时，
 * `findCandidateElements()` 被调用，通过两级搜索策略（L2 + L3）在页面中重新定位标记。
 */

import type { Mark } from './storage'
import { calculateSimilarity, findCommonAncestor, getAllTextNodes } from './dom'

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
    const candidate = createCandidate(mark, matchIndex, textNodes, fullText, mark.text.length)
    if (candidate) {
      const similarity = mark.surroundingSnippet ? calculateSimilarity(candidate.displayContext, mark.surroundingSnippet) : 100
      candidate.similarityScore = similarity
      candidates.push(candidate)
    }
    matchIndex = fullText.indexOf(mark.text, matchIndex + 1)
  }

  // --- Level 3: Fuzzy Match (Multi-Anchor Sliding Window) ---
  if (mark.surroundingSnippet && candidates.length === 0) {
    console.log('[WebMarker-Search] Performing Level 3 Multi-Anchor Search...')
    
    const snippet = mark.surroundingSnippet
    const anchorSize = 10
    const anchors: { text: string, offset: number }[] = []
    
    // 从 Snippet 中均匀提取 5 个锚点
    for (let i = 0; i < 5; i++) {
      const pos = Math.floor((snippet.length - anchorSize) * (i / 4))
      anchors.push({ text: snippet.substring(pos, pos + anchorSize), offset: pos })
    }

    // 在 FullText 中寻找每个锚点的最佳位置
    const results: { anchor: any, index: number, score: number }[] = []
    for (const anchor of anchors) {
      if (anchor.text.trim().length < 3) continue
      
      let bestScore = 0
      let bestIndex = -1
      
      for (let j = 0; j < fullText.length - anchor.text.length; j += 2) {
        const score = calculateSimilarity(fullText.substring(j, j + anchor.text.length), anchor.text)
        if (score > bestScore) {
          bestScore = score
          bestIndex = j
        }
        if (bestScore === 100) break
      }
      
      if (bestScore > 60) {
        results.push({ anchor, index: bestIndex, score: bestScore })
      }
    }

    if (results.length >= 2) {
      // 找到 Snippet 中 MarkText 的位置
      let markStartInSnippet = snippet.indexOf(mark.text)
      if (markStartInSnippet === -1) {
        markStartInSnippet = Math.floor((snippet.length - mark.text.length) / 2)
      }
      const markEndInSnippet = markStartInSnippet + mark.text.length

      // 推测 FullText 中的起始和结束
      const estimatedStarts = results.map(r => r.index - r.anchor.offset + markStartInSnippet)
      const estimatedEnds = results.map(r => r.index - r.anchor.offset + markEndInSnippet)
      
      const finalStart = Math.max(0, Math.round(estimatedStarts.sort((a, b) => a - b)[Math.floor(estimatedStarts.length / 2)]))
      const finalEnd = Math.min(fullText.length, Math.round(estimatedEnds.sort((a, b) => a - b)[Math.floor(estimatedEnds.length / 2)]))

      if (finalEnd > finalStart) {
        // 修正：在推测出的位置附近进行微调，确保内容尽可能匹配 mark.text 的两端
        let refinedStart = finalStart
        let refinedEnd = finalEnd
        
        // 如果原始文本在附近有更好的匹配，可以进一步对齐
        // 但目前直接 substring 即可，UI 会显示实际找到的内容
        const actualText = fullText.substring(refinedStart, refinedEnd)
        
        const candidate = createCandidate(mark, refinedStart, textNodes, fullText, refinedEnd - refinedStart)
        if (candidate) {
          candidate.similarityScore = results.reduce((acc, r) => acc + r.score, 0) / results.length
          candidate.displayTextSnippet = actualText
          candidates.push(candidate)
        }
      }
    }
  }

  const uniqueCandidates = Array.from(new Map(candidates.map(c => [`${c.candidateElement.innerHTML}-${c.matchIndex}`, c])).values())
  uniqueCandidates.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))

  let ambiguityLevel: AmbiguityLevel = 'none'
  if (uniqueCandidates.length === 1) {
    if ((uniqueCandidates[0].similarityScore || 0) >= 80)
      ambiguityLevel = 'unique'
    else
      ambiguityLevel = 'multiple'
  }
  else if (uniqueCandidates.length > 1) {
    const best = uniqueCandidates[0]
    const second = uniqueCandidates[1]
    if ((best.similarityScore || 0) >= 95 && ((best.similarityScore || 0) - (second.similarityScore || 0)) > 15)
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

function createCandidate(mark: Mark, matchIndex: number, textNodes: Text[], fullText: string, matchLength: number): Candidate | null {
  if (matchIndex < 0)
    return null

  const matchEnd = matchIndex + matchLength
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
  const end = Math.min(fullText.length, matchEnd + contextLength)
  const surroundingSnippet = fullText.substring(start, end)

  const blockContainer = findNearestBlockContainer(involvedNodes[0])
  let richContext = blockContainer ? (blockContainer.textContent?.trim() || '') : surroundingSnippet
  
  if (richContext.length < matchLength) {
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
    matchLength,
  }
}
