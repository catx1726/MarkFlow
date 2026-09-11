/**
 * 本地 JSON 备份/导入纯逻辑
 * Spec: docs/superpowers/specs/2026-09-11-local-backup-design.md
 *
 * 导出范围：marks + tags + settings（不含 syncConfig / GitHub Token）。
 * 导入语义：marks/tags 复用 sync.ts 的 merge（时间戳新者胜，不丢现有数据）；
 * settings 整体替换（旧备份缺新字段由默认值补齐）。
 */
import type { Mark, Tag } from './storage'
import { defaultSettings } from './settings'
import { mergeMarks, mergeTags } from './sync'

export const BACKUP_FORMAT = 'markflow-backup'
export const BACKUP_VERSION = 1

export interface BackupData {
  marks: Record<string, Mark[]>
  tags: Record<string, Tag>
  settings: Record<string, unknown>
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: number
  data: BackupData
}

/** 校验失败分类；上层按 kind 映射 i18n 词条（保持本模块零 i18n 依赖） */
export type BackupErrorKind = 'json' | 'format' | 'version' | 'data'

export class BackupParseError extends Error {
  readonly kind: BackupErrorKind
  constructor(kind: BackupErrorKind, message: string) {
    super(message)
    this.name = 'BackupParseError'
    this.kind = kind
  }
}

export function buildBackup(
  marks: Record<string, Mark[]>,
  tags: Record<string, Tag>,
  settings: Record<string, unknown>,
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    data: { marks, tags, settings },
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseBackupFile(text: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  }
  catch {
    throw new BackupParseError('json', 'File is not valid JSON')
  }
  if (!isPlainObject(parsed) || parsed.format !== BACKUP_FORMAT)
    throw new BackupParseError('format', 'Not a MarkFlow backup file')
  const { version, data } = parsed as Partial<BackupFile>
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > BACKUP_VERSION)
    throw new BackupParseError('version', 'Unsupported backup version')
  if (!isPlainObject(data) || !isPlainObject(data.marks) || !isPlainObject(data.tags) || !isPlainObject(data.settings))
    throw new BackupParseError('data', 'Backup data incomplete')
  for (const list of Object.values(data.marks as Record<string, unknown>)) {
    if (!Array.isArray(list))
      throw new BackupParseError('data', 'marks values must be arrays')
  }
  return parsed as BackupFile
}

export function applyBackup(
  localMarks: Record<string, Mark[]>,
  localTags: Record<string, Tag>,
  backup: BackupFile,
): { marks: Record<string, Mark[]>, tags: Record<string, Tag> } {
  return {
    marks: mergeMarks(localMarks, backup.data.marks),
    tags: mergeTags(localTags, backup.data.tags),
  }
}

export function restoredSettings(backup: BackupFile): typeof defaultSettings {
  return { ...defaultSettings, ...backup.data.settings } as typeof defaultSettings
}

export function countBackupStats(backup: BackupFile): { marks: number, tags: number } {
  const marks = Object.values(backup.data.marks)
    .reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0)
  return { marks, tags: Object.keys(backup.data.tags).length }
}
