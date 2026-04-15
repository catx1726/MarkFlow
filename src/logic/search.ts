/**
 * # 标记搜索算法 (Mark Search Algorithm)
 *
 * 本模块实现了网页标记的模糊搜索与恢复机制。
 * 核心算法：基于多维锚点共识 (Multi-Anchor Consensus) 的聚类搜索 + 局部对齐。
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
  console.log(`[WebMarker-Search] Starting generic search for ID: ${mark.id}`)

  const textNodes = getAllTextNodes(searchRoot)
  const fullText = textNodes.map(n => n.textContent || '').join('')
  const candidates: Candidate[] = []

  // 1. 预先识别结构化边界 (Headers)
  const structureBoundaries: { index: number, end: number, text: string }[] = []
  if (searchRoot instanceof HTMLElement || searchRoot instanceof ShadowRoot) {
    const headers = (searchRoot as HTMLElement).querySelectorAll('h1, h2, h3, h4, h5, h6')
    headers.forEach(h => {
      const txt = h.textContent?.trim()
      if (txt && txt.length > 2) {
        const idx = fullText.indexOf(txt)
        if (idx !== -1) structureBoundaries.push({ index: idx, end: idx + txt.length, text: txt })
      }
    })
  }

  // --- Level 2: 精确匹配 ---
  const findMatches = (pattern: string) => {
    let mIdx = fullText.indexOf(pattern)
    while (mIdx !== -1) {
      const candidate = createCandidate(mark, mIdx, textNodes, fullText, pattern.length)
      if (candidate) {
        candidate.similarityScore = 100
        candidates.push(candidate)
      }
      mIdx = fullText.indexOf(pattern, mIdx + 1)
    }
  }

  findMatches(mark.text)

  // Level 2.5: 空白符不敏感匹配 (处理 B站等页面的换行/多空格/零宽字符)
  if (candidates.length === 0) {
    const normalize = (s: string) => s.replace(/[\s\u200b]+/g, ' ').trim()
    const nMark = normalize(mark.text)
    if (nMark.length > 5) {
      // 使用正则进行模糊空白匹配，允许零宽字符和任意空白序列
      const regexSource = nMark.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\u200b]*')
      try {
        const regex = new RegExp(regexSource, 'g')
        let match
        // eslint-disable-next-line no-cond-assign
        while ((match = regex.exec(fullText)) !== null) {
          const candidate = createCandidate(mark, match.index, textNodes, fullText, match[0].length)
          if (candidate) {
            candidate.similarityScore = 98 // 给予略低的分数
            candidates.push(candidate)
          }
          if (candidates.length > 10)
            break
        }
      }
      catch (e) {
        console.warn('[WebMarker-Search] Regex fallback failed:', e)
      }
    }
  }

  // --- Level 3: 模糊匹配 (锚点共识算法) ---
  if (candidates.length === 0 && mark.surroundingSnippet) {
    console.log('[WebMarker-Search] Performing Level 3 Consensus Search...')
    
    const snippet = mark.surroundingSnippet
    const markText = mark.text
    
    // A. 定位 Mark 在 Snippet 中的理想相对位置
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
    const nMark = norm(markText)
    const nSnippet = norm(snippet)
    let markStartInSnippet = snippet.indexOf(markText)
    if (markStartInSnippet === -1) {
      const nIdx = nSnippet.indexOf(nMark)
      markStartInSnippet = nIdx !== -1 ? Math.floor((nIdx / nSnippet.length) * snippet.length) : Math.floor((snippet.length - markText.length) / 2)
    }
    const markEndInSnippet = markStartInSnippet + markText.length

    // B. 均匀提取指纹锚点
    const anchorSize = 12
    const anchorCount = 6
    const anchors: { text: string, offset: number }[] = []
    for (let i = 0; i < anchorCount; i++) {
      const pos = Math.floor((snippet.length - anchorSize) * (i / (anchorCount - 1)))
      const txt = snippet.substring(pos, pos + anchorSize)
      if (txt.trim().length >= 4) anchors.push({ text: txt, offset: pos })
    }

    // C. 搜索锚点位置
    const estimates: { suggestedStart: number, score: number }[] = []
    for (const anchor of anchors) {
      let bestS = 0, bestI = -1
      for (let j = 0; j < fullText.length - anchor.text.length; j += 2) {
        const score = calculateSimilarity(fullText.substring(j, j + anchor.text.length), anchor.text)
        if (score > bestS) { bestS = score; bestI = j }
        if (score === 100) break
      }
      if (bestS > 70) {
        estimates.push({ suggestedStart: bestI - anchor.offset + markStartInSnippet, score: bestS })
      }
    }

    // D. 寻找最佳共识簇心
    let bestClusterStart = -1
    let maxClusterScore = 0
    estimates.forEach(e1 => {
      let currentScore = 0
      estimates.forEach(e2 => {
        if (Math.abs(e1.suggestedStart - e2.suggestedStart) < 60) currentScore += e2.score
      })
      if (currentScore > maxClusterScore) {
        maxClusterScore = currentScore
        bestClusterStart = e1.suggestedStart
      }
    })

    if (bestClusterStart !== -1) {
      // E. 核心改进：在簇心附近通过 Local Alignment 精确对齐边界
      let bestSim = 0
      let finalStart = bestClusterStart
      let finalEnd = bestClusterStart + markText.length
      
      const lookRange = 80 // 增加探测范围
      const startBase = Math.max(0, bestClusterStart - lookRange)
      const startMax = Math.min(fullText.length, bestClusterStart + lookRange)
      
      // 预先计算期望的结束位置，但由于可能存在删除，探测范围要大
      const expectedEnd = bestClusterStart + markText.length
      const endMin = Math.max(0, expectedEnd - lookRange * 2) // 允许较大删除
      const endMax = Math.min(fullText.length, expectedEnd + lookRange)

      // 使用双端逼近法寻找最优边界
      for (let i = startBase; i < startMax; i++) {
        if (structureBoundaries.some(b => i >= b.index && i < b.end)) continue
        
        // j 的搜索范围应该相对于 i，且考虑到可能的长度大幅减少
        const jMin = i + Math.min(5, markText.length * 0.1) // 至少匹配一点
        const jMax = Math.min(fullText.length, i + markText.length + lookRange)
        
        for (let j = jMin; j < jMax; j++) {
          // 阻断非预期标题
          if (structureBoundaries.some(b => b.index > i && b.index < j && !markText.includes(b.text))) break
          
          const sub = fullText.substring(i, j)
          const sim = calculateSimilarity(sub, markText)
          
          // 长度惩罚：如果长度差异过大，稍微降低分数，除非匹配度极高
          // 这有助于在存在多个相似片段时选择长度更接近的一个
          const lengthRatio = Math.min(sub.length, markText.length) / Math.max(sub.length, markText.length)
          const weightedSim = sim * (0.8 + 0.2 * lengthRatio)

          if (weightedSim > bestSim) {
            bestSim = weightedSim
            finalStart = i
            finalEnd = j
          }
          if (sim === 100 && lengthRatio > 0.95) break 
        }
        if (bestSim > 98) break
      }

      if (bestSim > 40) {
        const actualText = fullText.substring(finalStart, finalEnd)
        const candidate = createCandidate(mark, finalStart, textNodes, fullText, finalEnd - finalStart)
        if (candidate) {
          candidate.similarityScore = bestSim
          candidate.displayTextSnippet = actualText
          candidates.push(candidate)
          console.log(`[WebMarker-Search] L3 Consensus Candidate: "${actualText.substring(0, 30)}..." (Sim: ${bestSim.toFixed(1)}%)`)
        }
      }
    }
  }

  const uniqueCandidates = Array.from(new Map(candidates.map(c => [`${c.candidateElement.innerHTML}-${c.matchIndex}`, c])).values())
  uniqueCandidates.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))

  let ambiguityLevel: AmbiguityLevel = 'none'
  if (uniqueCandidates.length === 1) {
    ambiguityLevel = (uniqueCandidates[0].similarityScore || 0) >= 75 ? 'unique' : 'multiple'
  } else if (uniqueCandidates.length > 1) {
    const best = uniqueCandidates[0]
    const second = uniqueCandidates[1]
    ambiguityLevel = ((best.similarityScore || 0) >= 95 && (best.similarityScore || 0) - (second.similarityScore || 0) > 20) ? 'unique' : 'multiple'
  }

  return { ambiguityLevel, candidates: uniqueCandidates }
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

function createCandidate(mark: Mark, matchIndex: number, textNodes: Text[], fullText: string, matchLength: number): Candidate | null {
  if (matchIndex < 0) return null
  const involvedNodes: Text[] = []
  let currentPos = 0
  const matchEnd = matchIndex + matchLength

  for (const node of textNodes) {
    const len = (node.textContent || '').length
    if (currentPos + len > matchIndex && currentPos < matchEnd) involvedNodes.push(node)
    currentPos += len
    if (currentPos >= matchEnd) break
  }

  if (involvedNodes.length === 0) return null
  const lca = findCommonAncestor(involvedNodes)

  let lcaStartPos = 0
  for (const node of textNodes) {
    if (lca.contains(node)) break
    lcaStartPos += (node.textContent || '').length
  }

  const contextLength = 25
  const start = Math.max(0, matchIndex - contextLength)
  const end = Math.min(fullText.length, matchEnd + contextLength)
  const surroundingSnippet = fullText.substring(start, end)

  const blockContainer = findNearestBlockContainer(involvedNodes[0])
  let richContext = blockContainer ? (blockContainer.textContent?.trim() || '') : surroundingSnippet
  if (richContext.length < matchLength) richContext = surroundingSnippet

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
