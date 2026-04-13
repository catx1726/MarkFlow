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
 *
 * ## 搜索策略层级
 *
 * | 层级 | 名称 | 触发条件 | 算法 | 阈值 |
 * |------|------|----------|------|------|
 * | L2 | 精确匹配 (Exact Match) | 始终执行 | 全文本 `indexOf` 查找标记原文 | - |
 * | L3 | 夹逼搜索 (Sandwich) | 存在 `surroundingSnippet` | 前哨 + 后哨双向匹配，锁定中间文本 | 前后哨各 >70% |
 *
 * ### L2 - 精确匹配
 * 最基础的匹配：在页面全文中查找标记的原始文本 (`mark.text`)。
 * 若页面内容未变，此方法 100% 命中。同一文本出现多次时会产生多个候选。
 *
 * ### L3 - 夹逼搜索 (Sandwich Method)
 * 当 L2 找到的匹配可能位置偏移，或原文已被修改时使用。
 * 1. 将 `surroundingSnippet` 拆分为前哨 (前 20 字符) 和后哨 (后 20 字符)
 * 2. 在全文中扫描最佳前哨位置
 * 3. 从前哨位置之后，扫描最佳后哨位置
 * 4. 前后哨都 >70% 相似度时，中间即为目标文本（即使中间文字已被修改）
 *
 * **核心优势**: 不依赖原文内容，仅依赖"邻居文本"，因此即使高亮文字被删改，
 * 只要上下文还在，就能毫米级定位。
 *
 * ## 相似度算法
 * 使用 Dice's Coefficient (双字母集合交集) 计算字符串相似度，返回 0-100 的整数百分比。
 * - 短字符串 (<2 字符) 降级为字符包含匹配
 * - 精确相等直接返回 100
 *
 * ## 歧义判定 (Ambiguity Level)
 * 搜索完成后，根据候选数量和质量判定歧义级别，供调用方决策：
 *
 * | 级别 | 条件 | 调用方行为 |
 * |------|------|-----------|
 * | `unique` | 仅 1 个候选且 score ≥ 85；或多个候选但最佳 ≥ 98 且领先第二名 > 15 分 | 自动恢复 (Level 2/3) |
 * | `multiple` | 其余情况 | 加入歧义队列，最终弹出 DisambiguationModal (Level 4) |
 *
 * ## Shadow DOM 支持
 * `getAllTextNodes()` 递归遍历 Shadow Root，确保 Web Components 内的文本也能被搜索到。
 *
 * @module search
 */

import type { Mark } from './storage'
import { findCommonAncestor, querySelectorDeep } from './dom'

export interface Candidate {
  id: string
  originalMarkId: string
  originalMarkText: string
  candidateElement: HTMLElement // 现在将是最小公共祖先
  displayTitle?: string
  displayTextSnippet: string
  displayContext: string
  similarityScore?: number
  matchIndex: number // 相对于 candidateElement 的本地起始偏移
  matchLength: number // 匹配文本的长度
}

/**
 * 计算两个字符串的相似度 (Dice's Coefficient + Short String Fallback)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.replace(/\s+/g, '').toLowerCase()
  const s2 = str2.replace(/\s+/g, '').toLowerCase()
  if (s1 === s2)
    return 100
  if (!s1 || !s2)
    return 0

  if (s1.length < 2 || s2.length < 2) {
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1
    let matches = 0
    for (const char of shorter) {
      if (longer.includes(char))
        matches++
    }
    return Math.round((matches / longer.length) * 100)
  }

  const bigrams1 = new Set<string>()
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substring(i, i + 2))
  }

  const bigrams2 = new Set<string>()
  for (let i = 0; i < s2.length - 1; i++) {
    bigrams2.add(s2.substring(i, i + 2))
  }

  let intersection = 0
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram))
      intersection++
  }

  return Math.round((200 * intersection) / (bigrams1.size + bigrams2.size))
}

export type AmbiguityLevel = 'none' | 'unique' | 'multiple'

/**
 * 获取指定节点下的所有文本节点（包含 Shadow DOM）
 */
export function getAllTextNodes(root: Node): Text[] {
  const nodes: Text[] = []
  const walker = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      nodes.push(node as Text)
    }
    else {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).shadowRoot) {
        Array.from((node as HTMLElement).shadowRoot!.childNodes).forEach(walker)
      }
      Array.from(node.childNodes).forEach(walker)
    }
  }
  walker(root)
  return nodes
}

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
  // 核心修复：即使 Level 2 找到了匹配，也要执行夹逼搜索，以防原位置内容已变
  if (mark.surroundingSnippet) {
    console.log('[WebMarker-Search] Performing Level 3 Sandwich Search to find the original anchor...')
    
    // 拆分指纹为前哨和后哨
    const prefix = mark.surroundingSnippet.substring(0, 20)
    const suffix = mark.surroundingSnippet.substring(mark.surroundingSnippet.length - 20)
    
    let bestPrefixScore = 0
    let bestPrefixIndex = -1
    let bestSuffixScore = 0
    let bestSuffixIndex = -1

    // 寻找最佳前哨
    for (let i = 0; i < fullText.length - prefix.length; i++) {
      const score = calculateSimilarity(fullText.substring(i, i + prefix.length), prefix)
      if (score > bestPrefixScore) {
        bestPrefixScore = score
        bestPrefixIndex = i
      }
    }

    // 寻找最佳后哨 (从前哨位置之后开始找)
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

    // 如果前后哨都找到了，中间就是我们要的高亮（哪怕文字变了）
    if (bestPrefixScore > 70 && bestSuffixScore > 70 && bestSuffixIndex > bestPrefixIndex) {
      const start = bestPrefixIndex + prefix.length
      const end = bestSuffixIndex
      const actualText = fullText.substring(start, end).trim()
      
      const candidate = createCandidate(mark, start, textNodes, fullText)
      if (candidate) {
        candidate.similarityScore = (bestPrefixScore + bestSuffixScore) / 2
        candidate.displayTextSnippet = actualText || mark.text
        candidates.push(candidate)
        console.log(`[WebMarker-Search] Level 3 Sandwich Result: "${actualText}" (Score: ${candidate.similarityScore}%)`)
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
    const display = window.getComputedStyle(current).display
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

  // 计算相对于 LCA 的本地 matchIndex
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
  const richContext = blockContainer ? (blockContainer.textContent?.trim() || '') : surroundingSnippet

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
