/**
 * # DOM 工具函数 (DOM Utilities)
 *
 * 本模块提供针对 Web 扩展场景的 DOM 操作工具，核心设计原则是 **Shadow DOM 穿透能力**。
 *
 * ## 功能分组
 *
 * | 分组 | 函数 | 用途 |
 * |------|------|------|
 * | **Shadow DOM 穿透** | `querySelectorDeep`<br>`querySelectorAllDeep` | 递归穿透 Shadow Root，查询 Web Components 内部元素 |
 * | **选择器生成** | `getElementSelector` | 为元素生成可复现的 CSS 选择器 (`#id` 或 `tag:nth-of-type(n)`) |
 * | **上下文提取** | `getHighlightContext` | 提取高亮选区的标题层级、顺序、周围片段 |
 * | **URL 规范化** | `getCanonicalUrlForMark` | 移除 URL 哈希和尾部斜杠，用于标记存储 |
 * | **标记识别** | `getMarkIdFromElement` | 从高亮 span 的 className 中提取唯一 ID |
 * | **z-index 管理** | `getMaxZIndex` | 获取页面最高 z-index，确保扩展 UI 置顶 |
 *
 * ## Shadow DOM 架构说明
 *
 * 浏览器扩展的内容脚本 (Content Script) 默认无法直接访问页面 Shadow DOM 内部。
 * 本模块通过以下方式解决：
 *
 * 1. **递归遍历**: `querySelectorDeep` 遍历所有 Shadow Root 的 `shadowRoot` 属性
 * 2. **事件捕获**: 在 `contentScripts/index.ts` 中使用 `addEventListener(..., true)` 捕获阶段
 * 3. **序列化隔离**: Rangy 序列化时传入正确的 `root` (ShadowRoot vs Document)
 * 4. **宿主标记**: 通过 `shadowHostSelector` 记录 Shadow DOM 宿主元素的 CSS 路径
 *
 * ### 使用示例
 *
 * ```typescript
 * // 标准 querySelector 无法找到 Shadow DOM 内的按钮
 * document.querySelector('my-component button.submit')  // null
 *
 * // querySelectorDeep 递归穿透
 * querySelectorDeep('my-component button.submit')      // <button class="submit">
 *
 * // 生成可复现的选择器
 * getElementSelector(element)  // "body > my-component:nth-of-type(1) > button.submit"
 *
 * // 提取高亮上下文
 * const context = getHighlightContext(range)
 * // { contextTitle: "安装说明", contextLevel: 2, contextOrder: 3, ... }
 * ```
 *
 * @module dom
 */

import rangy from 'rangy/lib/rangy-core'

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

  return Math.round((2 * intersection) / (bigrams1.size + bigrams2.size) * 100)
}

/**
 * 递归穿透 Shadow DOM，查找第一个匹配选择器的元素。
 * 
 * 当标准 `document.querySelector` 无法命中 Shadow Root 内部元素时使用。
 * 遍历顺序：先当前根 → 再遍历所有子元素的 shadowRoot（深度优先）。
 * 
 * @param selector CSS 选择器
 * @param root 起始根节点 (Document 或 ShadowRoot)，默认为 document
 * @returns 第一个匹配的元素，或 null
 */
export function querySelectorDeep(selector: string, root: Document | ShadowRoot = document): Element | null {
  const found = root.querySelector(selector)
  if (found)
    return found

  const allElements = root.querySelectorAll('*')
  for (const element of Array.from(allElements)) {
    if (element.shadowRoot) {
      const foundInShadow = querySelectorDeep(selector, element.shadowRoot)
      if (foundInShadow)
        return foundInShadow
    }
  }
  return null
}

/**
 * 递归穿透 Shadow DOM，查找所有匹配选择器的元素。
 * 
 * 与 `querySelectorDeep` 类似，但返回所有匹配项。
 * 常用于批量操作（如获取同一标记的所有高亮 span）。
 * 
 * @param selector CSS 选择器
 * @param root 起始根节点，默认为 document
 * @returns 所有匹配的元素数组
 */
export function querySelectorAllDeep(selector: string, root: Document | ShadowRoot = document): Element[] {
  let results: Element[] = []
  root.querySelectorAll(selector).forEach(el => results.push(el))
  const allElements = root.querySelectorAll('*')
  for (const element of Array.from(allElements)) {
    if (element.shadowRoot)
      results = results.concat(querySelectorAllDeep(selector, element.shadowRoot))
  }
  return results
}

/**
 * 为给定元素生成可复现的 CSS 选择器。
 * 
 * 生成策略：从元素向上遍历至 body，使用 `tagName:nth-of-type(index)` 格式。
 * 若元素有 id，优先使用 `#id`（自动通过 CSS.escape 转义特殊字符）。
 * 
 * @param el 目标元素
 * @returns CSS 选择器字符串，如 `body > div:nth-of-type(2) > p`
 */
export function getElementSelector(el: Element): string {
  if (!el || !(el instanceof Element))
    return ''
  if (el.id) {
    const escapedId = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(el.id) : el.id
    return `#${escapedId}`
  }
  const path: string[] = []
  let current: Element | null = el
  while (current) {
    const selector = current.tagName.toLowerCase()
    if (selector === 'body') {
      path.unshift(selector)
      break
    }
    const parentNode: HTMLElement | null = current.parentElement
    if (!parentNode) {
      path.unshift(selector)
      break
    }
    const siblings = Array.from(parentNode.children).filter((child: any) => (child as Element).tagName === current!.tagName)
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1
      path.unshift(`${selector}:nth-of-type(${index})`)
    }
    else {
      path.unshift(selector)
    }
    current = parentNode
  }
  return path.join(' > ')
}

/**
 * 获取当前页面的规范化 URL，移除哈希和尾部斜杠
 */
export function getCanonicalUrlForMark(): string {
  const { origin, pathname } = window.location
  const cleanedPathname = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return origin + cleanedPathname
}

/**
 * 获取页面中最高且有效的 z-index 值。
 * 
 * 遍历 body 的直接子元素，查找具有 position 和非 auto z-index 的元素。
 * 返回值至少为 1000，确保扩展 UI 始终置顶。
 * 
 * @returns 最大 z-index 值
 */
export function getMaxZIndex(): number {
  let maxZIndex = 0
  const elements = document.querySelectorAll('body > *')

  elements.forEach((el) => {
    const style = window.getComputedStyle(el)
    const zIndexString = style.zIndex
    const position = style.position

    if (zIndexString !== 'auto' && position !== 'static') {
      const zIndex = Number.parseInt(zIndexString, 10)
      if (!Number.isNaN(zIndex)) {
        maxZIndex = Math.max(maxZIndex, zIndex)
      }
    }
  })

  return Math.max(maxZIndex, 1000)
}

/**
 * 从元素中提取标记 ID
 */
export function getMarkIdFromElement(element: HTMLElement): string | null {
  const highlightClass = Array.from(element.classList).find(c => c.startsWith('webext-highlight-'))
  return highlightClass ? highlightClass.replace('webext-highlight-', '') : null
}

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

/**
 * 在容器中精确应用高亮
 * 
 * @param container 容器元素
 * @param textToFind 要高亮的文本
 * @param applier Rangy 高亮应用器
 * @param preferredOffset 首选偏移量
 */
export function applyPreciseHighlight(
  container: HTMLElement,
  textToFind: string,
  applier: rangy.RangyClassApplier,
  preferredOffset: number,
): { range: rangy.RangyRange, actualText: string } | null {
  const textNodes = getAllTextNodes(container)
  let currentLen = 0
  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0

  for (const node of textNodes) {
    const nodeLen = (node.textContent || '').length
    if (!startNode && preferredOffset < currentLen + nodeLen) {
      startNode = node
      startOffset = preferredOffset - currentLen
    }
    if (startNode && preferredOffset + textToFind.length <= currentLen + nodeLen) {
      endNode = node
      endOffset = (preferredOffset + textToFind.length) - currentLen
      break
    }
    currentLen += nodeLen
  }

  if (startNode && endNode) {
    const range = (rangy as any).createRange ? (rangy as any).createRange() : (startNode.ownerDocument as any).createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    applier.applyToRange(range)
    return { range, actualText: range.toString() }
  }
  return null
}

/**
 * 寻找一组节点的最小公共祖先 (Least Common Ancestor)
 * 
 * @param nodes 节点数组
 * @returns 最小公共祖先元素，默认为 document.body
 */
export function findCommonAncestor(nodes: Node[]): HTMLElement {
  if (nodes.length === 0)
    return document.body
  if (nodes.length === 1)
    return (nodes[0].nodeType === Node.ELEMENT_NODE ? nodes[0] : nodes[0].parentElement) as HTMLElement

  const contain = (parent: Node, child: Node) => {
    let curr: Node | null = child
    while (curr) {
      if (curr === parent)
        return true
      curr = curr.parentNode
    }
    return false
  }

  let lca = (nodes[0].nodeType === Node.ELEMENT_NODE ? nodes[0] : nodes[0].parentElement) as HTMLElement
  for (let i = 1; i < nodes.length; i++) {
    while (lca && !contain(lca, nodes[i])) {
      lca = lca.parentElement as HTMLElement
    }
  }
  return lca || (document.body as HTMLElement)
}

/**
 * 获取高亮选区的上下文（最近的上级标题）
 * 
 * 通过查找选区起始点之前最近的标题元素 (h1-h6)，
 * 为标记提供结构化上下文信息（标题、层级、顺序、周围片段）。
 * 支持 Shadow DOM：使用 querySelectorAllDeep 穿透查询。
 * 
 * @param range Rangy 选区对象
 * @returns 包含标题文本、选择器、层级、顺序和周围片段的对象
 */
export function getHighlightContext(range: rangy.RangyRange): {
  contextTitle: string
  contextSelector: string
  contextLevel: number
  contextOrder: number
  surroundingSnippet: string
} {
  const startNode = range.startContainer
  const startElement = (
    startNode.nodeType === Node.ELEMENT_NODE ? startNode : startNode.parentNode
  ) as HTMLElement | null
  const allHeadings = Array.from(querySelectorAllDeep('h1, h2, h3, h4, h5, h6'))
  let lastHeadingBeforeSelection: HTMLElement | null = null

  for (const heading of allHeadings) {
    const headingEl = heading as HTMLElement
    if (startElement && headingEl.compareDocumentPosition(startElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
      lastHeadingBeforeSelection = headingEl
    }
    else {
      break
    }
  }

  // 获取周围片段 (前后各 20 字符)
  const root = startNode.getRootNode()
  const container = (root instanceof ShadowRoot) ? root : document.body
  const containerText = container.textContent || ''

  // 关键修复：精准计算选区在容器文本中的偏移量，避免 indexOf 在多重复文本下的误判
  let index = -1
  try {
    const preRange = range.cloneRange()
    preRange.selectNodeContents(container)
    preRange.setEnd(range.startContainer, range.startOffset)
    index = preRange.toString().length
  }
  catch (e) {
    console.warn('[WebMarker] Failed to calculate precise offset, falling back to indexOf:', e)
    index = containerText.indexOf(range.toString())
  }

  const contextLength = 20
  const rangeText = range.toString()
  let surroundingSnippet = ''
  if (index !== -1) {
    const start = Math.max(0, index - contextLength)
    const end = Math.min(containerText.length, index + rangeText.length + contextLength)
    surroundingSnippet = containerText.substring(start, end)
  }

  const heading = lastHeadingBeforeSelection
  if (heading) {
    const tagName = heading.tagName.toLowerCase()
    const level = Number.parseInt(tagName.replace('h', ''), 10)
    const documentOrderIndex = allHeadings.indexOf(heading)

    return {
      contextTitle: heading.textContent?.trim() || '无标题章节',
      contextSelector: getElementSelector(heading),
      contextLevel: level,
      contextOrder: documentOrderIndex,
      surroundingSnippet,
    }
  }

  return {
    contextTitle: '未分类笔记',
    contextSelector: 'body',
    contextLevel: 7,
    contextOrder: -1,
    surroundingSnippet,
  }
}
