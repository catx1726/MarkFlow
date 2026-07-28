import { describe, expect, it } from 'vitest'
import { filterExistingTags } from '../logic/tags'
import type { Tag } from '../logic/storage'

function tag(id: string): Tag {
  return { id, name: id, color: '#000', createdAt: 0 }
}

describe('filterExistingTags', () => {
  it('保留 allTags 中现存的 id', () => {
    const all = [tag('a'), tag('b')]
    expect(filterExistingTags(['a', 'b'], all)).toEqual(['a', 'b'])
  })

  it('过滤掉已删除的悬空 id', () => {
    const all = [tag('a')]
    expect(filterExistingTags(['a', 'ghost'], all)).toEqual(['a'])
  })

  it('全部悬空时返回空数组', () => {
    const all = [tag('a')]
    expect(filterExistingTags(['x', 'y'], all)).toEqual([])
  })

  it('空输入返回空数组', () => {
    expect(filterExistingTags([], [tag('a')])).toEqual([])
  })

  it('保持原始顺序', () => {
    const all = [tag('a'), tag('b'), tag('c')]
    expect(filterExistingTags(['c', 'a', 'b'], all)).toEqual(['c', 'a', 'b'])
  })
})
