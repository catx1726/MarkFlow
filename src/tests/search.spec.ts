import { describe, expect, it } from 'vitest'
import { findCandidateElements } from '../logic/search'
import { getAllTextNodes } from '../logic/dom'
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
    // 构造一个受控的上下文
    // 前缀(20字): "12345678901234567890"
    // 文本: "amazing world" -> "amazzing world"
    // 后缀(20字): "09876543210987654321"
    const prefix = '12345678901234567890'
    const suffix = '09876543210987654321'
    
    document.body.innerHTML = `<div>${prefix}amazzing world${suffix}</div>`
    
    const mark = {
      id: 'test-id',
      text: 'amazing world',
      surroundingSnippet: `${prefix}amazing world${suffix}`,
    } as Mark

    const result = findCandidateElements(mark, document.body, 10)

    expect(result.ambiguityLevel).toBe('unique')
    expect(result.candidates.length).toBe(1)
    expect(result.candidates[0].similarityScore).toBeGreaterThan(85)
    // 夹逼算法应该精准提取出目标区域的内容
    expect(result.candidates[0].displayTextSnippet).toContain('mazzing world')
  })

  it('should extract text across multiple block elements', () => {
    document.body.innerHTML = '<div id="test"><p>Hello </p><p>World</p></div>'
    const nodes = getAllTextNodes(document.getElementById('test')!)
    const fullText = nodes.map((n: Text) => n.textContent).join('')
    expect(fullText).toBe('Hello World')
  })
})
