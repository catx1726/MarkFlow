import { describe, expect, it } from 'vitest'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupParseError,
  applyBackup,
  buildBackup,
  countBackupStats,
  parseBackupFile,
  restoredSettings,
} from '../logic/backup'
import type { Mark, Tag } from '../logic/storage'

function mark(id: string, createdAt: number, extra: Partial<Mark> = {}): Mark {
  return { id, url: 'https://a.com', text: `text-${id}`, note: '', color: '#FFFF00', rangySerialized: 's', createdAt, ...extra } as Mark
}

function tag(id: string, createdAt: number): Tag {
  return { id, name: `tag-${id}`, color: '#99FF99', createdAt } as Tag
}

function expectParseError(text: string, kind: string) {
  try {
    parseBackupFile(text)
    throw new Error('expected BackupParseError but nothing was thrown')
  }
  catch (err: any) {
    expect(err).toBeInstanceOf(BackupParseError)
    expect(err.kind).toBe(kind)
  }
}

describe('backup Logic', () => {
  describe('buildBackup', () => {
    it('应该生成带格式标识、版本号与导出时间的完整备份', () => {
      const marks = { 'https://a.com': [mark('1', 10)] }
      const tags = { t1: tag('t1', 10) }
      const settings = { defaultHighlightColor: '#FF0000' }
      const file = buildBackup(marks, tags, settings)
      expect(file.format).toBe(BACKUP_FORMAT)
      expect(file.version).toBe(BACKUP_VERSION)
      expect(file.exportedAt).toBeGreaterThan(0)
      expect(file.data.marks).toBe(marks)
      expect(file.data.tags).toBe(tags)
      expect(file.data.settings).toBe(settings)
    })
  })

  describe('parseBackupFile', () => {
    it('roundtrip：buildBackup 产物序列化后可解析回来', () => {
      const file = buildBackup({ 'https://a.com': [mark('1', 10)] }, { t1: tag('t1', 10) }, { theme: 'dark' })
      expect(parseBackupFile(JSON.stringify(file))).toEqual(file)
    })

    it('空数据块（空对象）合法', () => {
      const file = parseBackupFile(JSON.stringify(buildBackup({}, {}, {})))
      expect(file.data.marks).toEqual({})
      expect(file.data.tags).toEqual({})
      expect(file.data.settings).toEqual({})
    })

    it('非 JSON 内容抛 json 错误', () => {
      expectParseError('not-json', 'json')
    })

    it('format 不符抛 format 错误', () => {
      expectParseError(JSON.stringify({ format: 'other-tool', version: 1, data: {} }), 'format')
    })

    it('version 为 0 / 非整数 / 超前 抛 version 错误', () => {
      expectParseError(JSON.stringify({ format: BACKUP_FORMAT, version: 0, data: {} }), 'version')
      expectParseError(JSON.stringify({ format: BACKUP_FORMAT, version: 1.5, data: {} }), 'version')
      expectParseError(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, data: {} }), 'version')
    })

    it('data 缺块/非对象/marks 值非数组 抛 data 错误', () => {
      expectParseError(JSON.stringify({ format: BACKUP_FORMAT, version: 1 }), 'data')
      expectParseError(JSON.stringify({ format: BACKUP_FORMAT, version: 1, data: null }), 'data')
      expectParseError(JSON.stringify({ format: BACKUP_FORMAT, version: 1, data: { marks: null, tags: {}, settings: {} } }), 'data')
      expectParseError(JSON.stringify({ format: BACKUP_FORMAT, version: 1, data: { marks: { u: 'not-array' }, tags: {}, settings: {} } }), 'data')
    })
  })

  describe('applyBackup', () => {
    it('合并语义与 sync merge 一致：同 id 不同时间戳取新者', () => {
      const local = { 'https://a.com': [mark('1', 100)] }
      const backup = buildBackup({ 'https://a.com': [mark('1', 200, { text: 'new' })] }, {}, {})
      const result = applyBackup(local, {}, backup)
      expect(result.marks['https://a.com'][0].text).toBe('new')
    })

    it('本地独有数据保留、备份独有数据并入（含 tags）', () => {
      const local = { 'https://a.com': [mark('1', 100)] }
      const backup = buildBackup({ 'https://b.com': [mark('2', 50)] }, { t1: tag('t1', 50) }, {})
      const result = applyBackup(local, {}, backup)
      expect(result.marks['https://a.com']).toHaveLength(1)
      expect(result.marks['https://b.com']).toHaveLength(1)
      expect(result.tags.t1.id).toBe('t1')
    })
  })

  describe('restoredSettings', () => {
    it('旧备份缺新字段由默认值补齐', () => {
      const backup = buildBackup({}, {}, { defaultHighlightColor: '#FF0000' })
      const settings = restoredSettings(backup)
      expect(settings.defaultHighlightColor).toBe('#FF0000')
      expect(settings.shortcutSave).toBe('Alt+S')
    })

    it('备份值覆盖同名默认值', () => {
      const backup = buildBackup({}, {}, { highlightHeight: 12 })
      expect(restoredSettings(backup).highlightHeight).toBe(12)
    })
  })

  describe('countBackupStats', () => {
    it('跨 URL 求和标记数并统计标签数', () => {
      const backup = buildBackup(
        { 'https://a.com': [mark('1', 1), mark('2', 2)], 'https://b.com': [mark('3', 3)] },
        { t1: tag('t1', 1), t2: tag('t2', 2) },
        {},
      )
      expect(countBackupStats(backup)).toEqual({ marks: 3, tags: 2 })
    })
  })
})
