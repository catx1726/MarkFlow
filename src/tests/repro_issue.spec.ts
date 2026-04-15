import { beforeAll, describe, expect, it } from 'vitest'
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-classapplier'
import { findCandidateElements } from '../logic/search'
import type { Mark } from '../logic/storage'

describe('repro issues', () => {
  beforeAll(() => {
    rangy.init()
  })

  it('Case 1: should not drop leading "妮好"', () => {
    document.body.innerHTML = `
      <h1>1-2</h1>
      <div id="d1">妮好 Lorem ipsum dolor sit am\`e elit. Distinctio nulla ratione amet 121QW1111111</div>
      <div id="d2">妮好 soluta illo, vero sint cumque deserunt omnis aut ratione 122AS1111112</div>
      <h1>3-4</h1>
      <div id="d3">妮好 t consectetur adipisicing 125XS1111115</div>
      <div id="d4">妮好 Lorem ipnihil lquam cupiditate. 126XL1111116</div>
    `

    // The user selected d3 and d4 contents.
    const originalText = "妮好 t consectetur adipisicing 125XS1111115\n妮好 Lorem ipnihil lquam cupiditate. 126XL1111116"
    
    const mark = {
      id: 'case1',
      text: originalText,
      // Provide a snippet that allows L3 search to work correctly.
      surroundingSnippet: "3-4\n妮好 t consectetur adipisicing 125XS1111115\n妮好 Lorem ipnihil lquam cupiditate. 126XL1111116\n5-6",
    } as Mark

    // Simulate deletion: "t consectetur adipisicing" is removed from d3.
    const d3 = document.getElementById('d3')!
    d3.textContent = "妮好  125XS1111115"

    const { candidates } = findCandidateElements(mark, document.body)
    expect(candidates.length).toBeGreaterThan(0)
    const candidate = candidates[0]

    // Check if "妮好" is preserved
    expect(candidate.displayTextSnippet.trim()).toMatch(/^妮好/)
  })

  it('Case 2: should not truncate trailing "1111112"', () => {
     document.body.innerHTML = `
      <h1>1-2</h1>
      <div id="d1">妮好 Lorem ipsum dolor sit am\`e elit. Distinctio nulla ratione amet 121QW1111111</div>
      <div id="d2">妮好 soluta illo, vero sint cumque deserunt omnis aut ratione 122AS1111112</div>
    `
    
    // Deletion: "Lorem ipsum dolor sit am`e elit." removed from d1
    const originalText = "妮好 Lorem ipsum dolor sit am\`e elit. Distinctio nulla ratione amet 121QW1111111\n妮好 soluta illo, vero sint cumque deserunt omnis aut ratione 122AS1111112"
    
    const mark = {
      id: 'case2',
      text: originalText,
      surroundingSnippet: "1-2\n妮好 Lorem ipsum dolor sit am\`e elit. Distinctio nulla ratione amet 121QW1111111\n妮好 soluta illo, vero sint cumque deserunt omnis aut ratione 122AS1111112\n3-4",
    } as Mark

    // Delete the text
    const d1 = document.getElementById('d1')!
    d1.textContent = "妮好  Distinctio nulla ratione amet 121QW1111111"

    const { candidates } = findCandidateElements(mark, document.body)
    expect(candidates.length).toBeGreaterThan(0)
    const candidate = candidates[0]

    // Should include the trailing "1111112"
    expect(candidate.displayTextSnippet).toContain("122AS1111112")
    // Should also start with "妮好"
    expect(candidate.displayTextSnippet.trim()).toMatch(/^妮好/)
  })
})
