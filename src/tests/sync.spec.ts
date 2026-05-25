import { describe, expect, it } from 'vitest'
import { mergeMarks, mergeTags } from '../logic/sync'
import type { Mark, Tag } from '../logic/storage'

describe('Sync Logic', () => {
  describe('mergeMarks', () => {
    it('应该合并不同 URL 的标记', () => {
      const local = { url1: [{ id: '1', text: 'm1', createdAt: 10 } as Mark] }
      const remote = { url2: [{ id: '2', text: 'm2', createdAt: 20 } as Mark] }
      const result = mergeMarks(local, remote)
      expect(Object.keys(result)).toHaveLength(2)
      expect(result.url1[0].id).toBe('1')
      expect(result.url2[0].id).toBe('2')
    })

    it('同一 ID 下应该保留时间戳最新的版本', () => {
      const local = { url1: [{ id: '1', text: '旧内容', createdAt: 100 } as Mark] }
      const remote = { url1: [{ id: '1', text: '新内容', createdAt: 200 } as Mark] }
      const result = mergeMarks(local, remote)
      expect(result.url1).toHaveLength(1)
      expect(result.url1[0].text).toBe('新内容')
    })

    it('同一 ID 下如果本地更新，应该保留本地内容', () => {
      const local = { url1: [{ id: '1', text: '新内容', createdAt: 300 } as Mark] }
      const remote = { url1: [{ id: '1', text: '旧内容', createdAt: 200 } as Mark] }
      const result = mergeMarks(local, remote)
      expect(result.url1[0].text).toBe('新内容')
    })

    it('应该同步删除操作 (Tombstone)', () => {
      const local = { url1: [{ id: '1', text: 'm1', createdAt: 100 } as Mark] }
      const remote = { url1: [{ id: '1', text: 'm1', createdAt: 100, deletedAt: 200 } as Mark] }
      const result = mergeMarks(local, remote)
      expect(result.url1[0].deletedAt).toBe(200)
    })

    it('如果本地删除较新，应该保留删除状态', () => {
      const local = { url1: [{ id: '1', text: 'm1', createdAt: 100, deletedAt: 300 } as Mark] }
      const remote = { url1: [{ id: '1', text: 'm1', createdAt: 100, deletedAt: 200 } as Mark] }
      const result = mergeMarks(local, remote)
      expect(result.url1[0].deletedAt).toBe(300)
    })
  })

  describe('mergeTags', () => {
    it('应该合并标签并保留最新版本', () => {
      const local = { t1: { id: 't1', name: '旧名称', createdAt: 10 } as Tag }
      const remote = { t1: { id: 't1', name: '新名称', createdAt: 20 } as Tag }
      const result = mergeTags(local, remote)
      expect(result.t1.name).toBe('新名称')
    })
  })
})
