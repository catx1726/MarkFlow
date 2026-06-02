import { describe, expect, it } from 'vitest'
import { buildTagTree } from '../logic/tagTree'
import type { Mark, Tag } from '../logic/storage'

describe('buildTagTree', () => {
  it('应该能正确处理空数据', () => {
    const marksByUrl: Record<string, Mark[]> = {}
    const tagsMetadata: Record<string, Tag> = {}

    const tree = buildTagTree(marksByUrl, tagsMetadata)

    expect(tree).toHaveProperty('inbox')
    expect(tree.inbox.tagName).toBe('收集箱 (Inbox)')
    expect(tree.inbox.totalMarks).toBe(0)
    expect(Object.keys(tree.inbox.pages)).toHaveLength(0)
  })

  it('没有标签的标记应进入收集箱', () => {
    const marksByUrl: Record<string, Mark[]> = {
      'url-1': [
        { id: 'm1', url: 'url-1', text: 'text 1', createdAt: 100, note: '', color: 'blue', rangySerialized: '' },
      ],
    }
    const tagsMetadata: Record<string, Tag> = {}

    const tree = buildTagTree(marksByUrl, tagsMetadata)

    expect(tree.inbox.totalMarks).toBe(1)
    expect(tree.inbox.pages['url-1']).toBeDefined()
    expect(tree.inbox.pages['url-1'].totalMarks).toBe(1)
  })

  it('应该能按标签分类标记', () => {
    const marksByUrl: Record<string, Mark[]> = {
      'url-1': [
        { id: 'm1', url: 'url-1', text: 'text 1', createdAt: 100, tags: ['tag-1'], note: '', color: 'blue', rangySerialized: '' },
      ],
    }
    const tagsMetadata: Record<string, Tag> = {
      'tag-1': { id: 'tag-1', name: 'My Tag', color: 'red', createdAt: 50 },
    }

    const tree = buildTagTree(marksByUrl, tagsMetadata)

    expect(tree['tag-1']).toBeDefined()
    expect(tree['tag-1'].tagName).toBe('My Tag')
    expect(tree['tag-1'].totalMarks).toBe(1)
    expect(tree['tag-1'].pages['url-1']).toBeDefined()
    expect(tree.inbox.totalMarks).toBe(0)
  })

  it('同一个标记属于多个标签时应在多处显示', () => {
    const marksByUrl: Record<string, Mark[]> = {
      'url-1': [
        { id: 'm1', url: 'url-1', text: 'text 1', createdAt: 100, tags: ['tag-1', 'tag-2'], note: '', color: 'blue', rangySerialized: '' },
      ],
    }
    const tagsMetadata: Record<string, Tag> = {
      'tag-1': { id: 'tag-1', name: 'T1', color: 'red', createdAt: 50 },
      'tag-2': { id: 'tag-2', name: 'T2', color: 'green', createdAt: 60 },
    }

    const tree = buildTagTree(marksByUrl, tagsMetadata)

    expect(tree['tag-1'].totalMarks).toBe(1)
    expect(tree['tag-2'].totalMarks).toBe(1)
  })

  it('标签不存在时应退回到收集箱', () => {
    const marksByUrl: Record<string, Mark[]> = {
      'url-1': [
        { id: 'm1', url: 'url-1', text: 'text 1', createdAt: 100, tags: ['non-existent'], note: '', color: 'blue', rangySerialized: '' },
      ],
    }
    const tagsMetadata: Record<string, Tag> = {}

    const tree = buildTagTree(marksByUrl, tagsMetadata)

    expect(tree.inbox.totalMarks).toBe(1)
  })

  it('应该排除已标记为删除的标记', () => {
    const marksByUrl: Record<string, Mark[]> = {
      'url-1': [
        { id: 'm1', url: 'url-1', text: 'deleted', createdAt: 100, deletedAt: 200, note: '', color: 'blue', rangySerialized: '' },
      ],
    }
    const tagsMetadata: Record<string, Tag> = {}

    const tree = buildTagTree(marksByUrl, tagsMetadata)

    expect(tree.inbox.totalMarks).toBe(0)
  })
})
