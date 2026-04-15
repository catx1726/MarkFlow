import { beforeAll, describe, expect, it } from 'vitest'
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-classapplier'
import { findCandidateElements } from '../logic/search'
import { applyPreciseHighlight } from '../logic/dom'
import type { Mark } from '../logic/storage'

describe('cross-element integration', () => {
  beforeAll(() => {
    rangy.init()
  })

  it('should find and apply highlight across two <p> tags', () => {
    document.body.innerHTML = '<div id="container"><p id="p1">Hello </p><p id="p2">World</p></div>'
    const mark = {
      id: 'test-mark',
      text: 'Hello World',
      surroundingSnippet: 'Hello World',
    } as Mark

    // 1. Search
    const { ambiguityLevel, candidates } = findCandidateElements(mark, document.body)
    expect(ambiguityLevel).toBe('unique')
    expect(candidates.length).toBe(1)
    
    const candidate = candidates[0]
    expect(candidate.displayTextSnippet).toBe('Hello World')
    expect(candidate.candidateElement.id).toBe('container')

    // 2. Apply
    const applier = rangy.createClassApplier('test-highlight')
    const rangeResult = applyPreciseHighlight(
      candidate.candidateElement,
      candidate.displayTextSnippet,
      applier,
      candidate.matchIndex
    )

    expect(rangeResult).not.toBeNull()
    expect(rangeResult!.actualText).toBe('Hello World')
    
    // 验证 DOM 结构
    const highlights = document.querySelectorAll('.test-highlight')
    expect(highlights.length).toBe(2) // 一个在 p1，一个在 p2
    expect(highlights[0].textContent).toBe('Hello ')
    expect(highlights[1].textContent).toBe('World')
  })

  it('should handle partial matches within nodes', () => {
    document.body.innerHTML = '<div id="container"><p>Start <span>Middle</span> End</p></div>'
    // 寻找 "rt Middle E"
    const mark = {
      id: 'test-mark-2',
      text: 'rt Middle E',
    } as Mark

    const { candidates } = findCandidateElements(mark, document.body)
    expect(candidates.length).toBe(1)
    const candidate = candidates[0]

    const applier = rangy.createClassApplier('test-highlight-2')
    const rangeResult = applyPreciseHighlight(
      candidate.candidateElement,
      candidate.displayTextSnippet,
      applier,
      candidate.matchIndex
    )

    expect(rangeResult).not.toBeNull()
    expect(rangeResult!.actualText).toBe('rt Middle E')
    
    const highlights = document.querySelectorAll('.test-highlight-2')
    expect(highlights.length).toBe(3) // "rt", "Middle", "E"
  })

  it('should handle deletion in middle of cross-element highlight (Reported Issue)', () => {
    // 构造 DOM
    document.body.innerHTML = `
      <h1>1-2</h1>
      <div id="d1">妮好 Lorem ipsum dolor sit am\`e elit. Distinctio nulla ratione amet 121QW1111111</div>
      <div id="d2">妮好 soluta illo, vero sint cumque deserunt omnis aut ratione 122AS1111112</div>
      <h1>3-4</h1>
      <div id="d3">妮好 corporis inventore aspernatur laborum amet culpa? 123WE1111113</div>
      <div id="d4">妮好 repudiandae fuga? Nulla 124ER1111114</div>
    `

    const mark = {
      id: 'reported-id',
      text: "妮好 corporis inventore aspernatur laborum amet culpa? 123WE1111113\n    妮好 repudiandae fuga? Nulla 124ER1111114",
      surroundingSnippet: "1-2\\n    妮好 Lorem...1111112\\n    3-4\\n    妮好 corporis inventore aspernatur laborum amet culpa? 123WE1111113\\n    妮好 repudiandae fuga? Nulla 124ER1111114\\n    5-6",
    } as Mark

    // 执行删除操作
    const d3 = document.getElementById('d3')!
    d3.textContent = "妮好  laborum amet culpa? 123WE1111113"

    // 1. Search
    const { candidates } = findCandidateElements(mark, document.body)
    
    expect(candidates.length).toBeGreaterThan(0)
    const candidate = candidates[0]
    
    // 验证内容是否包含两部分，且不包含 H1 (3-4)
    expect(candidate.displayTextSnippet).not.toContain("3-4")
    expect(candidate.displayTextSnippet).toContain("laborum amet culpa")
    expect(candidate.displayTextSnippet).toContain("124ER1111114")
  })
})
