import { describe, expect, it } from 'vitest'
import { canPush, mergeMarks, mergeTags, mergeWithRemoteFile } from '../logic/sync'
import type { Mark, SyncConfig, SyncStatus, Tag } from '../logic/storage'

describe('sync Logic', () => {
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

  describe('canPush', () => {
    const baseConfig: SyncConfig = { enabled: true, token: 'tok', gistId: 'gist', autoSync: true }
    const baseStatus: SyncStatus = { lastSyncTime: 0, lastSyncStatus: 'success', errorMessage: '' }

    it('未启用同步时不应推送', () => {
      expect(canPush({ ...baseConfig, enabled: false }, baseStatus)).toBe(false)
    })

    it('缺少 token 时不应推送', () => {
      expect(canPush({ ...baseConfig, token: '' }, baseStatus)).toBe(false)
    })

    it('缺少 gistId 时不应推送', () => {
      expect(canPush({ ...baseConfig, gistId: '' }, baseStatus)).toBe(false)
    })

    it('从未成功同步过时不应推送', () => {
      expect(canPush(baseConfig, { ...baseStatus, lastSyncStatus: 'none' })).toBe(false)
    })

    it('同步失败时允许重试推送', () => {
      expect(canPush(baseConfig, { ...baseStatus, lastSyncStatus: 'error' })).toBe(true)
    })

    it('启用、配置完整且已成功同步过时可以推送', () => {
      expect(canPush(baseConfig, baseStatus)).toBe(true)
    })
  })

  describe('mergeWithRemoteFile', () => {
    it('应把远程数据合并到本地', () => {
      const localMarks = { url1: [{ id: '1', text: 'local', createdAt: 100 } as Mark] }
      const localTags = { t1: { id: 't1', name: 'local', createdAt: 10 } as Tag }
      const remoteContent = JSON.stringify({
        marks: { url2: [{ id: '2', text: 'remote', createdAt: 200 } as Mark] },
        tags: { t2: { id: 't2', name: 'remote', createdAt: 20 } as Tag },
        lastSync: Date.now(),
      })

      const result = mergeWithRemoteFile(localMarks, localTags, remoteContent)

      expect(Object.keys(result.marks)).toHaveLength(2)
      expect(result.marks.url2[0].id).toBe('2')
      expect(result.tags.t2.name).toBe('remote')
    })

    it('远程文件内容为空时应保持本地数据不变', () => {
      const localMarks = { url1: [{ id: '1', text: 'local', createdAt: 100 } as Mark] }
      const localTags = { t1: { id: 't1', name: 'local', createdAt: 10 } as Tag }

      const result = mergeWithRemoteFile(localMarks, localTags, '')

      expect(result.marks.url1[0].id).toBe('1')
      expect(result.tags.t1.name).toBe('local')
    })

    it('远程文件内容损坏时应保持本地数据不变', () => {
      const localMarks = { url1: [{ id: '1', text: 'local', createdAt: 100 } as Mark] }
      const localTags = { t1: { id: 't1', name: 'local', createdAt: 10 } as Tag }

      const result = mergeWithRemoteFile(localMarks, localTags, 'not-valid-json{')

      expect(result.marks.url1[0].id).toBe('1')
      expect(result.tags.t1.name).toBe('local')
    })

    it('远程字段缺失时应视为空对象', () => {
      const localMarks = { url1: [{ id: '1', text: 'local', createdAt: 100 } as Mark] }
      const result = mergeWithRemoteFile(localMarks, {}, JSON.stringify({ lastSync: 1 }))
      expect(result.marks.url1[0].id).toBe('1')
    })
  })
})
