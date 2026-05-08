import { describe, expect, it } from 'vitest'
import { ShadowDOMManager } from '../logic/shadowDom'

describe('ShadowDOMManager', () => {
  describe('createContainer', () => {
    it('should create a container with correct id, position, and zIndex', () => {
      const container = ShadowDOMManager.createContainer('test-container', 9999)
      expect(container.id).toBe('test-container')
      expect(container.style.position).toBe('fixed')
      expect(container.style.zIndex).toBe('9999')
    })
  })

  describe('buildShadowHostSelector', () => {
    it('should return undefined for normal DOM elements', () => {
      const div = document.createElement('div')
      document.body.appendChild(div)
      const result = ShadowDOMManager.buildShadowHostSelector(div)
      expect(result).toBeUndefined()
      document.body.removeChild(div)
    })

    it('should build selector chain for elements inside ShadowRoot', () => {
      const host = document.createElement('div')
      host.id = 'shadow-host'
      document.body.appendChild(host)
      const shadowRoot = host.attachShadow({ mode: 'open' })
      const innerDiv = document.createElement('div')
      innerDiv.id = 'inner'
      shadowRoot.appendChild(innerDiv)
      const result = ShadowDOMManager.buildShadowHostSelector(innerDiv)
      expect(result).toBe('#shadow-host')
      document.body.removeChild(host)
    })
  })

  describe('resolveShadowHost', () => {
    it('should resolve single-level shadow host', () => {
      const host = document.createElement('div')
      host.id = 'resolve-host'
      document.body.appendChild(host)
      const shadowRoot = host.attachShadow({ mode: 'open' })
      const innerDiv = document.createElement('div')
      shadowRoot.appendChild(innerDiv)
      const selector = ShadowDOMManager.buildShadowHostSelector(innerDiv)
      expect(selector).toBe('#resolve-host')
      const resolved = ShadowDOMManager.resolveShadowHost(selector!)
      expect(resolved).toBe(shadowRoot)
      document.body.removeChild(host)
    })

    it('should return undefined for non-existent selector', () => {
      const result = ShadowDOMManager.resolveShadowHost('#non-existent-host')
      expect(result).toBeUndefined()
    })
  })
})
