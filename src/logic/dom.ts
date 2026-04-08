import rangy from 'rangy/lib/rangy-core'

/**
 * Recursively searches for an element matching the selector, piercing through Shadow DOMs.
 */
export function querySelectorDeep(selector: string, root: Document | ShadowRoot = document): Element | null {
  const found = root.querySelector(selector)
  if (found) return found

  const allElements = root.querySelectorAll('*')
  for (const element of Array.from(allElements)) {
    if (element.shadowRoot) {
      const foundInShadow = querySelectorDeep(selector, element.shadowRoot)
      if (foundInShadow) return foundInShadow
    }
  }
  return null
}

/**
 * Recursively searches for all elements matching the selector, piercing through Shadow DOMs.
 */
export function querySelectorAllDeep(selector: string, root: Document | ShadowRoot = document): Element[] {
  let results: Element[] = []
  root.querySelectorAll(selector).forEach((el) => results.push(el))
  const allElements = root.querySelectorAll('*')
  for (const element of Array.from(allElements)) {
    if (element.shadowRoot) results = results.concat(querySelectorAllDeep(selector, element.shadowRoot) as any)
  }
  return results
}

/**
 * Generates a CSS selector for a given element.
 */
export function getElementSelector(el: Element): string {
  if (!el || !(el instanceof Element)) return ''
  if (el.id) {
    const escapedId = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(el.id) : el.id
    return `#${escapedId}`
  }
  const path: string[] = []
  let current: Element | null = el
  while (current) {
    let selector = current.tagName.toLowerCase()
    if (selector === 'body') {
      path.unshift(selector)
      break
    }
    const parent = current.parentElement
    if (!parent) {
      path.unshift(selector)
      break
    }
    const siblings = Array.from(parent.children).filter((child) => child.tagName === current!.tagName)
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1
      selector += `:nth-of-type(${index})`
    }
    path.unshift(selector)
    current = parent
  }
  return path.join(' > ')
}

/**
 * 获取高亮选区的上下文（最近的上级标题）
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
    if (startElement && heading.compareDocumentPosition(startElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
      lastHeadingBeforeSelection = heading as HTMLElement
    } else {
      break
    }
  }

  // 获取周围片段 (前后各 20 字符)
  const root = startNode.getRootNode()
  const fullText = root.textContent || ''
  
  // 使用 rangy 的 bookmark 功能安全获取偏移量
  // 注意：此处简化处理，假设在同一个文档/ShadowRoot内
  const selectedText = range.toString()
  
  // 查找匹配项在全文中的位置（近似处理，因为 DOM 结构复杂时很难得到单一 offset）
  // 更好的做法是利用 range.startContainer 和 startOffset
  // 但为了快速原型，我们先尝试简单的全文索引寻找（如果文本唯一）
  // 或者使用更加健壮的算法。
  
  // 暂时使用简单的上下文提取逻辑
  const contextLength = 20
  const rangeText = range.toString()
  
  // 获取整个容器的文本
  const container = (root instanceof ShadowRoot) ? root : document.body
  const containerText = container.textContent || ''
  
  // 尝试在容器文本中定位选区位置
  // 这是一个启发式方法
  const index = containerText.indexOf(rangeText)
  let surroundingSnippet = ''
  if (index !== -1) {
    const start = Math.max(0, index - contextLength)
    const end = Math.min(containerText.length, index + rangeText.length + contextLength)
    surroundingSnippet = containerText.substring(start, end)
  }

  const heading = lastHeadingBeforeSelection
  if (heading) {
    const tagName = heading.tagName.toLowerCase()
    const level = parseInt(tagName.replace('h', ''), 10)
    const documentOrderIndex = allHeadings.indexOf(heading)

    return {
      contextTitle: heading.textContent?.trim() || '无标题章节',
      contextSelector: getElementSelector(heading),
      contextLevel: level,
      contextOrder: documentOrderIndex,
      surroundingSnippet
    }
  }

  return {
    contextTitle: '未分类笔记',
    contextSelector: 'body',
    contextLevel: 7,
    contextOrder: -1,
    surroundingSnippet
  }
}
