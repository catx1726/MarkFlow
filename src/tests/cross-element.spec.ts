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
})
