import { beforeAll, describe, expect, it } from 'vitest'
import rangy from 'rangy/lib/rangy-core'
import { findCommonAncestor, getHighlightContext } from '../logic/dom'
import { buildTagTree } from '../logic/tagTree'

describe('metadata capture', () => {
  beforeAll(() => {
    rangy.init()
  })

  it('should find common ancestor for multiple nodes', () => {
    document.body.innerHTML = `
      <div id="parent">
        <p id="p1">First</p>
        <div>
          <span id="s1">Second</span>
        </div>
      </div>
    `
    const p1 = document.getElementById('p1')!
    const s1 = document.getElementById('s1')!
    const parent = document.getElementById('parent')!

    expect(findCommonAncestor([p1, s1])).toBe(parent)
  })

  it('should find context from a simple heading', () => {
    document.body.innerHTML = `
      <h1 id="h1">Section 1</h1>
      <p id="p1">Target text</p>
    `
    const p1 = document.getElementById('p1')!
    const range = rangy.createRange()
    range.selectNodeContents(p1)

    const context = getHighlightContext(range)

    expect(context.contextTitle).toBe('Section 1')
    expect(context.contextSelector).toBe('#h1')
    expect(context.contextLevel).toBe(1)
    expect(context.contextOrder).toBe(0)
    expect(context.surroundingSnippet).toContain('Target text')
  })

  it('should capture surrounding text context', () => {
    document.body.innerHTML = '<div>Before text - Target text - After text</div>'
    const div = document.querySelector('div')!
    const range = rangy.createRange()
    // Select "Target text"
    const textNode = div.firstChild as Text
    const start = textNode.textContent!.indexOf('Target text')
    range.setStart(textNode, start)
    range.setEnd(textNode, start + 'Target text'.length)

    const context = getHighlightContext(range)
    expect(context.surroundingSnippet.trim()).toBe('Before text - Target text - After text')
  })

  it('should return default context when no heading exists', () => {
    document.body.innerHTML = `
      <p id="p2">No heading here</p>
    `
    const p2 = document.getElementById('p2')!
    const range = rangy.createRange()
    range.selectNodeContents(p2)

    const context = getHighlightContext(range)

    expect(context.contextTitle).toBe('未分类笔记')
    expect(context.contextSelector).toBe('body')
    expect(context.contextOrder).toBe(-1)
  })

  it('buildTagTree should calculate totalMarks for folders', () => {
    const marksByUrl = {
      'https://example.com': [
        { id: '1', url: 'https://example.com', text: 't1', createdAt: 100, tags: ['inbox'] },
        { id: '2', url: 'https://example.com', text: 't2', createdAt: 200, tags: ['tag1'] }
      ]
    }
    const tagsMetadata = {
      tag1: { id: 'tag1', name: 'Tag 1', color: 'red', createdAt: 0 }
    }
    const tree = buildTagTree(marksByUrl as any, tagsMetadata as any)
    expect(tree.inbox.totalMarks).toBe(1)
    expect(tree.tag1.totalMarks).toBe(1)
  })
})
