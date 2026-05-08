import { DOMSelector, querySelectorDeep } from './dom'

export const SHADOW_HOST_SEPARATOR = '|>>>|'

export class ShadowDOMManager {
  static createContainer(id: string, zIndex: number): HTMLDivElement {
    const container = document.createElement('div')
    container.id = id
    container.style.position = 'fixed'
    container.style.zIndex = `${zIndex}`
    container.style.fontSize = '16px'
    return container
  }

  static attachStylesheet(shadowRoot: ShadowRoot, href: string): void {
    const styleEl = document.createElement('link')
    styleEl.setAttribute('rel', 'stylesheet')
    styleEl.setAttribute('href', href)
    shadowRoot.appendChild(styleEl)
  }

  static createDarkModeClass(shadowRoot: ShadowRoot): void {
    const uiRoot = document.createElement('div')
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) uiRoot.classList.add('dark')
    shadowRoot.appendChild(uiRoot)
  }

  static buildShadowHostSelector(element: Element): string | undefined {
    const root = element.getRootNode()
    if (root instanceof ShadowRoot) {
      const chain: string[] = []
      let currRoot: Node = root
      while (currRoot instanceof ShadowRoot) {
        chain.unshift(DOMSelector.getElementSelector(currRoot.host))
        currRoot = currRoot.host.getRootNode()
      }
      return chain.join(SHADOW_HOST_SEPARATOR)
    }
    return undefined
  }

  static resolveShadowHost(selector: string): ShadowRoot | undefined {
    let host: Element | null = null
    if (selector.includes(SHADOW_HOST_SEPARATOR)) {
      const chain = selector.split(SHADOW_HOST_SEPARATOR)
      let currentRoot: Document | ShadowRoot = document
      for (const sel of chain) {
        host = currentRoot.querySelector(sel)
        if (host && host.shadowRoot)
          currentRoot = host.shadowRoot
        else {
          host = null
          break
        }
      }
    }
    else {
      host = querySelectorDeep(selector)
    }
    if (host && host.shadowRoot)
      return host.shadowRoot
    return undefined
  }
}
