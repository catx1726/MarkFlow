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
    // 注意：手动加入换行和空格，模拟真实环境
    document.body.innerHTML = '<div id="container">' + 
      '<div id="d1">妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111</div>' +
      '    <div id="d2">妮好 soluta illo, vero sint cumque deserunt omnis aut ratione 122AS1111112</div>' +
      '</div>'

    const mark = {
      id: 'reported-id',
      text: "妮好 Lorem ipsum dolor sit am\`e elit. Distinctio nulla ratione amet 121QW1111111\n    妮好 soluta illo, vero sint cumque deserunt omnis aut ratione 122AS1111112",
      surroundingSnippet: "\n    1-2\n    妮好 Lorem ipsum dolor sit am\`e elit. Distinctio nulla ratione amet 121QW1111111\n    妮好 soluta illo, vero sint cumque deserunt omnis aut ratione 122AS1111112\n    3-4",
    } as Mark

    // 执行删除操作
    const d1 = document.getElementById('d1')!
    d1.textContent = "妮好  Distinctio nulla ratione amet 121QW1111111"

    // 1. Search
    const { ambiguityLevel, candidates } = findCandidateElements(mark, document.body)
    
    expect(candidates.length).toBeGreaterThan(0)
    const candidate = candidates[0]
    
    // 验证内容是否包含两部分
    expect(candidate.displayTextSnippet).toContain("Distinctio nulla ratione")
    expect(candidate.displayTextSnippet).toContain("122AS1111112")

    // 2. Apply (模拟 Hover)
    const applier = rangy.createClassApplier('test-preview')
    const rangeResult = applyPreciseHighlight(
      candidate.candidateElement,
      candidate.displayTextSnippet,
      applier,
      candidate.matchIndex
    )

    expect(rangeResult).not.toBeNull()
    const previewHighlights = document.querySelectorAll('.test-preview')
    expect(previewHighlights.length).toBeGreaterThanOrEqual(2)
  })
})
