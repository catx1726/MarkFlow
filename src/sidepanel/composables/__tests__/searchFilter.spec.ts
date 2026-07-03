import { describe, expect, it } from 'vitest'
import { filterTagTree, isMarkMatch } from '../searchFilter'
import type { TagTree } from '~/logic/tagTree'

interface TestMark {
  id: string
  text?: string
  html?: string
  note?: string
  url?: string
  title?: string
  contextTitle?: string
  createdAt?: number
  tags?: string[]
}

function buildSampleTree(): TagTree {
  const markA: TestMark = {
    id: 'a',
    text: 'hello world',
    html: '<mark>hello world</mark>',
    url: 'https://example.com/page-a',
    title: 'Page A',
    createdAt: 1,
    tags: ['tag1'],
  }

  const markB: TestMark = {
    id: 'b',
    text: 'another note',
    html: '<mark>another note</mark>',
    url: 'https://example.com/page-b',
    title: 'Page B',
    createdAt: 2,
    tags: ['tag2'],
  }

  return {
    tag1: { tagName: 'Tag One', totalMarks: 1, pages: {
      'https://example.com/page-a': { pageTitle: 'Page A', groups: [{
        title: 'Group A', level: 7, selector: 'body', marks: [markA as any], count: 1, order: 0,
      }], totalMarks: 1 },
    }},
    tag2: { tagName: 'Tag Two', totalMarks: 1, pages: {
      'https://example.com/page-b': { pageTitle: 'Page B', groups: [{
        title: 'Group B', level: 7, selector: 'body', marks: [markB as any], count: 1, order: 0,
      }], totalMarks: 1 },
    }},
  }
}

function buildSampleTreeWithMultipleMarks(): TagTree {
  const markA: TestMark = {
    id: 'a',
    text: 'hello world',
    createdAt: 1,
  }

  const markC: TestMark = {
    id: 'c',
    text: 'context here',
    createdAt: 3,
  }

  return {
    tag1: { tagName: 'Tag One', totalMarks: 2, pages: {
      'https://example.com/page-a': { pageTitle: 'Page A', groups: [{
        title: 'Group A', level: 7, selector: 'body', marks: [markA as any, markC as any], count: 2, order: 0,
      }], totalMarks: 2 },
    }},
  }
}

describe('isMarkMatch', () => {
  it('matches text content', () => {
    const mark = { text: 'hello world' } as any
    expect(isMarkMatch(mark, ['hello'])).toBe(true)
  })

  it('requires all terms (AND)', () => {
    const mark = { text: 'hello world' } as any
    expect(isMarkMatch(mark, ['hello', 'mars'])).toBe(false)
  })
})

describe('filterTagTree', () => {
  it('returns full tree when query is empty', () => {
    const tree = buildSampleTree()
    expect(filterTagTree(tree, '')).toEqual(tree)
  })

  it('keeps entire page when a mark matches by default', () => {
    const tree = buildSampleTreeWithMultipleMarks()
    const result = filterTagTree(tree, 'hello')
    expect(result).toHaveProperty('tag1')
    expect(result).not.toHaveProperty('tag2')
    // 上下文模式下应保留 page 中所有 marks，而不仅是命中的 mark
    expect(result.tag1.pages['https://example.com/page-a'].groups[0].marks).toHaveLength(2)
  })

  it('keeps only matching marks in showOnlyMatches mode', () => {
    const tree = buildSampleTreeWithMultipleMarks()
    const result = filterTagTree(tree, 'hello', true)
    expect(result).toHaveProperty('tag1')
    const page = result.tag1.pages['https://example.com/page-a']
    expect(page.groups[0].marks).toHaveLength(1)
    expect(page.groups[0].marks[0].text).toBe('hello world')
  })

  it('matches page title', () => {
    const tree = buildSampleTree()
    const result = filterTagTree(tree, 'page b')
    expect(result).toHaveProperty('tag2')
    expect(result).not.toHaveProperty('tag1')
  })

  it('matches tag name', () => {
    const tree = buildSampleTree()
    const result = filterTagTree(tree, 'one')
    expect(result).toHaveProperty('tag1')
    expect(result).not.toHaveProperty('tag2')
  })

  it('uses AND for multiple terms', () => {
    const tree = buildSampleTree()
    const result = filterTagTree(tree, 'hello another')
    expect(Object.keys(result).length).toBe(0)
  })
})
