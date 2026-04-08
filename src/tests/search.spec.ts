import { describe, expect, it } from 'vitest'
import { findCandidateElements } from '../logic/search'
import type { Mark } from '../logic/storage'

describe('search logic - recursive traversal', () => {
  it('should find text in simple DOM', () => {
    document.body.innerHTML = '<div>Hello World</div>'
    const mark = { text: 'Hello' } as Mark
    const result = findCandidateElements(mark, document.body, 10)

    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.candidates[0].displayTextSnippet).toBe('Hello')
  })

  it('should find text inside Shadow DOM', () => {
    document.body.innerHTML = '<div id="host"></div>'
    const host = document.getElementById('host')!
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = '<span>Shadow Text</span>'

    const mark = { text: 'Shadow' } as Mark
    const result = findCandidateElements(mark, document.body, 10)

    expect(result.candidates.length).toBe(1)
    expect(result.candidates[0].displayTextSnippet).toBe('Shadow')
  })

  it('should find text spanning multiple text nodes', () => {
    document.body.innerHTML = '<div><span>Hello </span>World</div>'
    const mark = { text: 'Hello World' } as Mark
    const result = findCandidateElements(mark, document.body, 10)

    expect(result.candidates.length).toBe(1)
    expect(result.candidates[0].displayTextSnippet).toBe('Hello World')
  })

  it('should find unique candidate even if text has minor changes (fuzzy)', () => {
    document.body.innerHTML = '<div>Welcome to the amazing world of coding!</div>'
    const mark = {
      text: 'amazing world',
      surroundingSnippet: 'to the amazing world of coding',
    } as Mark

    // Simulate a minor change: "amazing" -> "amazzing"
    document.body.innerHTML = '<div>Welcome to the amazzing world of coding!</div>'

    const result = findCandidateElements(mark, document.body, 10)

    expect(result.ambiguityLevel).toBe('unique')
    expect(result.candidates[0].similarityScore).toBeGreaterThan(85)
  })
})
