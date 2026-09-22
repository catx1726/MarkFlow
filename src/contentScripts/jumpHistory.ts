/**
 * 跳转历史栈：记录「点击标记跳转原文」前的视口位置，支持逐级回退。
 * 内存态、随标签页/content script 生命周期，页面刷新即清空，不做持久化。
 */

export interface ScrollPosition {
  x: number
  y: number
  ancestors: Array<{ el: Element, top: number, left: number }>
}

export const MAX_DEPTH = 50

export class JumpHistoryManager {
  private stack: ScrollPosition[] = []

  get depth(): number {
    return this.stack.length
  }

  /**
   * 在 scrollIntoView 之前调用：捕获 window 滚动位置与 target 全部可滚动祖先。
   * 记录元素引用，恢复时若祖先已脱离 DOM（SPA 容器复用）则跳过该层。
   */
  capture(target: Element): void {
    const ancestors: ScrollPosition['ancestors'] = []
    let node = this.nextAncestor(target)
    while (node) {
      if (this.isScrollable(node))
        ancestors.push({ el: node, top: node.scrollTop, left: node.scrollLeft })
      node = this.nextAncestor(node)
    }
    this.stack.push({ x: window.scrollX, y: window.scrollY, ancestors })
    if (this.stack.length > MAX_DEPTH)
      this.stack.shift()
  }

  /** 弹栈并恢复位置；栈空返回 false */
  restore(): boolean {
    const position = this.stack.pop()
    if (!position)
      return false
    for (const { el, top, left } of position.ancestors) {
      if (!el.isConnected)
        continue
      el.scrollTop = top
      el.scrollLeft = left
    }
    window.scrollTo(position.x, position.y)
    return true
  }

  /** 向上取父元素，穿透 shadow DOM 边界 */
  private nextAncestor(el: Element): Element | null {
    if (el.parentElement)
      return el.parentElement
    const root = el.getRootNode()
    return root instanceof ShadowRoot ? root.host : null
  }

  private isScrollable(el: Element): boolean {
    if (el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)
      return false
    const { overflowX, overflowY } = getComputedStyle(el)
    return /auto|scroll/.test(overflowY) || /auto|scroll/.test(overflowX)
  }
}

export const jumpHistory = new JumpHistoryManager()
