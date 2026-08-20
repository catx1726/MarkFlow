import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useSidepanelData } from '../useSidepanelData'
import { filterTagTree, isMarkMatch } from '../searchFilter'
import { marksByUrl, tagsMetadata } from '~/logic/storage'
import type { TagTree } from '~/logic/tagTree'

// Mock storage
vi.mock('~/logic/storage', () => ({
  marksByUrl: { value: {} },
  tagsMetadata: { value: {} },
}))

// Mock buildTagTree
vi.mock('~/logic/tagTree', () => ({
  buildTagTree: vi.fn(() => ({ mocked: true, count: 1 })),
}))

// Minimal mark shape for filter tests; avoid importing Mark from storage
// to prevent webextension-polyfill from loading in test environment.
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
        title: 'Group A',
        level: 7,
        selector: 'body',
        marks: [markA as any],
        count: 1,
        order: 0,
      }], totalMarks: 1 },
    } },
    tag2: { tagName: 'Tag Two', totalMarks: 1, pages: {
      'https://example.com/page-b': { pageTitle: 'Page B', groups: [{
        title: 'Group B',
        level: 7,
        selector: 'body',
        marks: [markB as any],
        count: 1,
        order: 0,
      }], totalMarks: 1 },
    } },
  }
}

describe('useSidepanelData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    marksByUrl.value = {}
    tagsMetadata.value = {}
  })

  it('should initialize with default structure', () => {
    const { structuredMarks } = useSidepanelData()
    expect(structuredMarks.value).toHaveProperty('inbox')
  })

  it('should update structuredMarks when storage changes (debounced)', async () => {
    const { structuredMarks } = useSidepanelData()

    // Simulate storage update
    marksByUrl.value = { url1: [] }
    await nextTick()

    // Should not update immediately due to debounce
    expect(structuredMarks.value).not.toHaveProperty('mocked')

    // Fast-forward time
    vi.advanceTimersByTime(50)
    await nextTick()

    expect(structuredMarks.value).toEqual({ mocked: true, count: 1 })
  })
})

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

  it('keeps entire page when a mark matches', () => {
    const tree = buildSampleTree()
    const result = filterTagTree(tree, 'hello')
    expect(result).toHaveProperty('tag1')
    expect(result).not.toHaveProperty('tag2')
    expect(result.tag1.pages['https://example.com/page-a'].groups[0].marks).toHaveLength(1)
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
