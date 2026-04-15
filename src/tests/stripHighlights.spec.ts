import { describe, expect, it } from 'vitest'
import { stripHighlights } from '../logic/dom'

describe('stripHighlights', () => {
  it('should remove highlight spans while preserving content', () => {
    const div = document.createElement('div')
    div.innerHTML = 'Hello <span class="webext-highlight-123">world</span>!'
    stripHighlights(div)
    expect(div.innerHTML).toBe('Hello world!')
  })

  it('should handle nested highlights', () => {
    const div = document.createElement('div')
    div.innerHTML = 'A <span class="webext-highlight-1">B <span class="webext-highlight-2">C</span> D</span> E'
    stripHighlights(div)
    expect(div.innerHTML).toBe('A B C D E')
  })

  it('should handle complex HTML inside highlights', () => {
    const div = document.createElement('div')
    div.innerHTML = '<span class="webext-highlight-1"><b>Bold</b> and <i>italic</i></span>'
    stripHighlights(div)
    expect(div.innerHTML).toBe('<b>Bold</b> and <i>italic</i>')
  })

  it('should handle DocumentFragment', () => {
    const fragment = document.createDocumentFragment()
    const span = document.createElement('span')
    span.className = 'webext-highlight-123'
    span.textContent = 'content'
    fragment.appendChild(span)
    
    // Note: querySelectorAll on fragment works in JSDOM/Browsers
    stripHighlights(fragment)
    expect(fragment.textContent).toBe('content')
    expect(fragment.querySelector('span')).toBeNull()
  })
})
