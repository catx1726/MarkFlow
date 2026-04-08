import type rangy from 'rangy/lib/rangy-core'

/**
 * Recursively searches for an element matching the selector, piercing through Shadow DOMs.
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
 * Recursively searches for all elements matching the selector, piercing through Shadow DOMs.
 */
export function querySelectorAllDeep(selector: string, root: Document | ShadowRoot = document): Element[] {
  let results: Element[] = []
  root.querySelectorAll(selector).forEach(el => results.push(el))
  const allElements = root.querySelectorAll('*')
  for (const element of Array.from(allElements)) {
    if (element.shadowRoot)
      results = results.concat(querySelectorAllDeep(selector, element.shadowRoot) as any)
  }
  return results
}

/**
 * Generates a CSS selector for a given element.
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
    const siblings = Array.from(parent.children).filter(child => child.tagName === current!.tagName)
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
 * 用于获取页面上最高且有效的 z-index 值。
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
 * 获取当前页面的规范化 URL，移除哈希和尾部斜杠
 */
export function getCanonicalUrlForMark(): string {
  const { origin, pathname } = window.location
  const cleanedPathname = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return origin + cleanedPathname
}

/**
 * 从元素中提取标记 ID
 */
export function getMarkIdFromElement(element: HTMLElement): string | null {
  const highlightClass = Array.from(element.classList).find(c => c.startsWith('webext-highlight-'))
  return highlightClass ? highlightClass.replace('webext-highlight-', '') : null
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
    }
    else {
      break
    }
  }

  // 获取周围片段 (前后各 20 字符)
  const root = startNode.getRootNode()

  // 暂时使用简单的上下文提取逻辑
  const contextLength = 20
  const rangeText = range.toString()

  // 获取整个容器的文本
  const container = (root instanceof ShadowRoot) ? root : document.body
  const containerText = container.textContent || ''

  // 尝试在容器文本中定位选区位置
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
