import type { Mark } from './storage'
import { querySelectorDeep } from './dom'

export interface Candidate {
  originalMarkId: string
  candidateElement: HTMLElement
  displayTitle?: string
  displayTextSnippet: string
  displayContext: string
  similarityScore?: number
}

/**
 * 计算两个字符串的相似度 (Dice's Coefficient)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.replace(/\s+/g, '')
  const s2 = str2.replace(/\s+/g, '')
  if (s1 === s2)
    return 100
  if (s1.length < 2 || s2.length < 2)
    return 0

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
function getAllTextNodes(root: Node): Text[] {
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

/**
 * 查找最近的块级容器元素
 */
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

export function findCandidateElements(
  mark: Mark,
  searchRoot: Node,
  _contextExtractionLength: number = 10,
): { ambiguityLevel: AmbiguityLevel, candidates: Candidate[] } {
  // 1. 确定搜索起点
  let searchArea = searchRoot
  if (mark.contextSelector) {
    const container = querySelectorDeep(mark.contextSelector, searchRoot as any)
    if (container) {
      searchArea = container
    }
  }

  // 2. 获取平铺的文本流
  const textNodes = getAllTextNodes(searchArea)
  const fullText = textNodes.map(n => n.textContent || '').join('')

  const candidates: Candidate[] = []

  // --- Level 2: Exact Match ---
  let matchIndex = fullText.indexOf(mark.text)
  while (matchIndex !== -1) {
    const candidate = createCandidate(mark, matchIndex, textNodes, fullText)
    if (candidate) {
      candidate.similarityScore = 100
      candidates.push(candidate)
    }
    matchIndex = fullText.indexOf(mark.text, matchIndex + 1)
  }

  // --- Level 3: Fuzzy Match (If no exact matches or we want to be robust) ---
  if (candidates.length === 0 && mark.surroundingSnippet) {
    // 简单的滑动窗口模糊匹配 (此处为演示，性能可优化)
    // 目标是找到与 surroundingSnippet 相似的片段
    const windowSize = mark.surroundingSnippet.length
    const step = 5
    for (let i = 0; i < fullText.length - windowSize; i += step) {
      const chunk = fullText.substring(i, i + windowSize)
      const score = calculateSimilarity(chunk, mark.surroundingSnippet)
      if (score > 85) {
        // 在该片段中尝试定位最接近 mark.text 的部分
        // 这里简化处理：直接取 chunk 中间对应位置
        const candidate = createCandidate(mark, i + (mark.surroundingSnippet.indexOf(mark.text) || 0), textNodes, fullText)
        if (candidate) {
          candidate.similarityScore = score
          candidates.push(candidate)
        }
      }
    }
  }

  // 5. 排序：优先匹配 similarityScore，然后是 displayTitle
  candidates.sort((a, b) => {
    if (b.similarityScore !== a.similarityScore) {
      return (b.similarityScore || 0) - (a.similarityScore || 0)
    }
    const aMatch = a.displayTitle === mark.contextTitle ? 1 : 0
    const bMatch = b.displayTitle === mark.contextTitle ? 1 : 0
    return bMatch - aMatch
  })

  // 6. 去重并分析歧义
  const uniqueCandidates = Array.from(new Map(candidates.map(c => [c.candidateElement, c])).values())

  let ambiguityLevel: AmbiguityLevel = 'none'
  if (uniqueCandidates.length === 1) {
    ambiguityLevel = 'unique'
  }
  else if (uniqueCandidates.length > 1) {
    ambiguityLevel = 'multiple'
  }

  return { ambiguityLevel, candidates: uniqueCandidates }
}

/**
 * 辅助函数：根据索引创建 Candidate
 */
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
      const blockContainer = findNearestBlockContainer(matchedNode)
      const richContext = blockContainer ? (blockContainer.textContent?.trim() || '') : fullText.substring(Math.max(0, matchIndex - 20), matchIndex + mark.text.length + 20)

      return {
        originalMarkId: mark.id,
        candidateElement: parentElement,
        displayTitle: mark.contextTitle,
        displayTextSnippet: mark.text,
        displayContext: richContext,
      }
    }
  }
  return null
}
