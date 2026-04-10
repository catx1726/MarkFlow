import type { Mark } from './storage'
import { querySelectorDeep } from './dom'

export interface Candidate {
  id: string // 候选者唯一标识 (用于 UI 绑定)
  originalMarkId: string
  originalMarkText: string // 原始标注的文本
  candidateElement: HTMLElement
  displayTitle?: string
  displayTextSnippet: string
  displayContext: string
  similarityScore?: number
  matchIndex: number // 关键：存储全局文本流中的精确起始偏移量
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

  let currentLen = 0
  let matchedNode: Text | null = null
  for (const node of textNodes) {
    const nodeTextLen = (node.textContent || '').length
    if (matchIndex < currentLen + nodeTextLen) {
      matchedNode = node
      break
    }
    currentLen += nodeTextLen
  }

  if (matchedNode) {
    const parentElement = matchedNode.parentElement || (matchedNode.parentNode as HTMLElement)
    if (parentElement) {
      // --- 关键修复：计算相对于 parentElement 的本地偏移量 ---
      let parentStartOffset = 0
      for (const node of textNodes) {
        if (parentElement.contains(node))
          break
        parentStartOffset += (node.textContent || '').length
      }
      const localMatchIndex = matchIndex - parentStartOffset

      const contextLength = 20
      const start = Math.max(0, matchIndex - contextLength)
      const end = Math.min(fullText.length, matchIndex + mark.text.length + contextLength)
      const surroundingSnippet = fullText.substring(start, end)

      const blockContainer = findNearestBlockContainer(matchedNode)
      const richContext = blockContainer ? (blockContainer.textContent?.trim() || '') : surroundingSnippet

      return {
        id: `${mark.id}-${matchIndex}-${Math.random().toString(36).substring(2, 7)}`,
        originalMarkId: mark.id,
        originalMarkText: mark.text,
        candidateElement: parentElement,
        displayTitle: mark.contextTitle,
        displayTextSnippet: mark.text,
        displayContext: richContext,
        matchIndex: localMatchIndex, // 现在存储的是本地坐标
      }
    }
  }
  return null
}
