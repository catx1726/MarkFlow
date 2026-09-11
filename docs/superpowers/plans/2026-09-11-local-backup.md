# 本地 JSON 备份/导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Options 页新增「备份与恢复」区：全量导出 marks+tags+settings 为带版本号的本地 JSON，导入经格式校验与确认后合并落库（复用 sync merge 语义）。

**Architecture:** 纯函数模块 `src/logic/backup.ts`（格式常量/校验/合并/恢复/统计，零 IO、零 i18n 依赖）+ `Options.vue` UI（导出走 Blob 下载，导入走隐藏 file input → parse → 确认弹窗 → 写三个 storage 单例 → 复用广播刷新）。**不含 syncConfig（GitHub Token）**。

**Tech Stack:** Vue 3 `<script setup>` + vitest（`src/tests/` 同构）+ webext-bridge 广播。分支 `feat/local-backup`（已切出，HEAD = 38a9da2 spec 提交）。

**Spec:** `docs/superpowers/specs/2026-09-11-local-backup-design.md`

**基线债务（验收口径：触碰文件零新增）**：全量 vitest 既有 5 failed + 1 suite error（tagTree×4 / useUIState×1 / useSidepanelData）；lint 既有 1386 错误；`tsc --noEmit` 既有 ~30 错误（且不解析 .vue，SFC 错误靠 `npm run build` 兜底）。

---

### Task 1: `backup.ts` 纯函数（TDD）

**Files:**
- Create: `src/logic/backup.ts`
- Test: `src/tests/backup.spec.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/tests/backup.spec.ts`（完整内容）：

```ts
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

const mark = (id: string, createdAt: number, extra: Partial<Mark> = {}): Mark =>
  ({ id, url: 'https://a.com', text: `text-${id}`, note: '', color: '#FFFF00', rangySerialized: 's', createdAt, ...extra }) as Mark

const tag = (id: string, createdAt: number): Tag =>
  ({ id, name: `tag-${id}`, color: '#99FF99', createdAt }) as Tag

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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/tests/backup.spec.ts`
Expected: FAIL —— `Failed to resolve import "../logic/backup"`（模块不存在）

- [ ] **Step 3: 实现 `src/logic/backup.ts`（完整内容）**

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/tests/backup.spec.ts`
Expected: PASS —— 12 个用例全绿

- [ ] **Step 5: Commit**

```bash
git add src/logic/backup.ts src/tests/backup.spec.ts
git commit -m "feat(backup): 本地备份纯逻辑——格式常量/校验/合并/恢复/统计（TDD 12 测全绿）"
```

---

### Task 2: i18n 双语词条

**Files:**
- Modify: `src/logic/i18n/locales/zh-CN.ts:111`（`githubSync` 行后插入）
- Modify: `src/logic/i18n/locales/en.ts:111`（`githubSync` 行后插入）

- [ ] **Step 1: zh-CN.ts 插入词条**

在 `    githubSync: 'GitHub 同步',` 行后插入：

```ts
    backupSection: '备份与恢复',
    backupDesc: '将标记、标签与设置导出为本地 JSON 备份文件，或从备份文件恢复。备份不包含 GitHub Token。',
    exportBackup: '导出备份',
    importBackup: '导入备份',
    backupImportConfirm: '该备份导出于 {date}，包含 {marks} 条标记、{tags} 个标签。导入将合并标记与标签（不会删除现有数据），并覆盖当前全部设置。是否继续？',
    backupImportSuccess: '导入完成：当前共 {marks} 条标记、{tags} 个标签，设置已恢复为备份时的状态。',
    backupErrorJson: '文件内容不是有效的 JSON，无法读取。',
    backupErrorFormat: '这不是 MarkFlow 的备份文件。',
    backupErrorVersion: '该备份由更新版本的 MarkFlow 导出，请先升级扩展。',
    backupErrorData: '备份数据不完整，无法导入。',
```

- [ ] **Step 2: en.ts 插入词条**

在 `    githubSync: 'GitHub sync',` 行后插入：

```ts
    backupSection: 'Backup & Restore',
    backupDesc: 'Export marks, tags and settings to a local JSON backup file, or restore from one. Backups never contain your GitHub Token.',
    exportBackup: 'Export backup',
    importBackup: 'Import backup',
    backupImportConfirm: 'This backup was exported on {date} and contains {marks} marks and {tags} tags. Importing merges marks and tags (existing data is kept) and replaces all current settings. Continue?',
    backupImportSuccess: 'Import complete: {marks} marks and {tags} tags in total, settings restored to the backup state.',
    backupErrorJson: 'The file is not valid JSON and cannot be read.',
    backupErrorFormat: 'This is not a MarkFlow backup file.',
    backupErrorVersion: 'This backup was exported by a newer version of MarkFlow. Please upgrade the extension first.',
    backupErrorData: 'The backup data is incomplete and cannot be imported.',
```

- [ ] **Step 3: 同构校验**

Run: `npx vitest run src/tests/i18n.spec.ts`
Expected: PASS —— 「en 与 zh-CN 字典结构同构」用例通过（漏一侧会直接红）

- [ ] **Step 4: Commit**

```bash
git add src/logic/i18n/locales/zh-CN.ts src/logic/i18n/locales/en.ts
git commit -m "feat(backup): Options 备份/导入双语词条（i18n 同构校验通过）"
```

---

### Task 3: Options.vue 基础改造——广播抽取 + 确认弹窗

**Files:**
- Modify: `src/options/Options.vue:95-128`（saveSettings 尾部 + exportLogs 附近）、`49-65`（alertInfo/showAlert/hideAlert）、`794-801`（弹窗按钮区）

- [ ] **Step 1: 抽取 notifyContextsChanged**

`saveSettings` 尾部（`sendMessage('refresh-sidepanel-data', ...)` 起至函数闭合 `}`）整体替换，并在 `exportLogs` 函数之后新增公共函数：

```ts
async function saveSettings() {
  settings.value = cloneDeep(localSettings)
  saveStatus.value = t('options.settingsSaved')
  isJustSaved.value = true
  clearTimeout(saveTimeout)
  clearTimeout(saveResetTimeout)
  saveTimeout = window.setTimeout(() => {
    saveStatus.value = ''
  }, 2000)
  saveResetTimeout = window.setTimeout(() => {
    isJustSaved.value = false
  }, 2000)
  await notifyContextsChanged()
}

/** 通知 background/sidepanel 与所有 content script：设置/数据已变化（保存设置、导入备份共用） */
async function notifyContextsChanged() {
  // 通知 background 脚本，以便它可以广播刷新指令
  sendMessage('refresh-sidepanel-data', {}, 'background').catch(() => {
    // 忽略错误
  })
  // 通知所有 content script 刷新高亮样式
  const tabs = await browser.tabs.query({ status: 'complete' })
  for (const tab of tabs) {
    if (tab.id && tab.url && tab.url.startsWith('http')) {
      sendMessage('refresh-highlights', {}, { context: 'content-script', tabId: tab.id }).catch(() => {})
    }
  }
}
```

- [ ] **Step 2: alertInfo 支持确认模式**

`alertInfo`/`showAlert`/`hideAlert`（49-65 行）替换为：

```ts
const alertInfo = reactive({
  visible: false,
  title: t('options.alertTitle'),
  message: '',
  isHtml: false,
  onConfirm: null as null | (() => void),
})

function showAlert(message: string, title = t('options.alertTitle'), isHtml = false) {
  alertInfo.title = title
  alertInfo.message = message
  alertInfo.isHtml = isHtml
  alertInfo.onConfirm = null
  alertInfo.visible = true
}

/** 确认模式：显示 取消/确定 双按钮，确定才执行回调 */
function showConfirm(message: string, onConfirm: () => void, title = t('options.alertTitle')) {
  alertInfo.title = title
  alertInfo.message = message
  alertInfo.isHtml = false
  alertInfo.onConfirm = onConfirm
  alertInfo.visible = true
}

function hideAlert() {
  alertInfo.visible = false
  alertInfo.onConfirm = null
}

function confirmAlert() {
  const action = alertInfo.onConfirm
  hideAlert()
  action?.()
}
```

- [ ] **Step 3: 弹窗模板按钮区加「取消」**

模板 794-801 行的 `<div class="flex justify-end">`…`</div>` 替换为：

```html
        <div class="flex justify-end gap-[12px]">
          <button
            v-if="alertInfo.onConfirm"
            class="px-[16px] py-2 text-[14px] font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-600"
            @click="hideAlert"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            class="px-[16px] py-2 text-[14px] font-medium text-neutral-900 bg-amber-500 rounded-md hover:bg-amber-600"
            @click="alertInfo.onConfirm ? confirmAlert() : hideAlert()"
          >
            {{ t('common.confirm') }}
          </button>
        </div>
```

- [ ] **Step 4: 验证**

Run: `npx eslint src/options/Options.vue && npm run build`
Expected: eslint 0 error（触碰文件零新增）；build 编译通过（tsc 不解析 .vue，build 是 SFC 兜底）

- [ ] **Step 5: Commit**

```bash
git add src/options/Options.vue
git commit -m "refactor(options): 抽取 notifyContextsChanged 广播 + alert 弹窗支持确认（取消/确定）模式"
```

---

### Task 4: Options.vue 备份区 UI 与导出/导入逻辑

**Files:**
- Modify: `src/options/Options.vue`（imports:10-11 / navItems:240 / exportLogs 后新增函数 / `<!-- Error Logs -->`:747 前插入 section）

- [ ] **Step 1: 补 imports**

第 10 行 storage 导入追加 `settingsReady`（现有：`dataReady, marksByUrl, syncConfig, syncReady, syncStatus, tagsMetadata, tagsReady`）；第 11 行 sync 导入之后新增：

```ts
import { applyBackup, buildBackup, countBackupStats, parseBackupFile, restoredSettings, BackupParseError } from '~/logic/backup'
import type { BackupFile } from '~/logic/backup'
```

- [ ] **Step 2: navItems 插入 backup 项**

```ts
  { id: 'github-sync', label: 'options.githubSync' },
  { id: 'backup', label: 'options.backupSection' },
  { id: 'error-logs', label: 'options.errorLogs' },
```

- [ ] **Step 3: script 新增导出/导入逻辑（置于 exportLogs 之后）**

```ts
// ========== 备份与恢复 ==========
const fileInputRef = ref<HTMLInputElement | null>(null)

const backupErrorKeys = {
  json: 'options.backupErrorJson',
  format: 'options.backupErrorFormat',
  version: 'options.backupErrorVersion',
  data: 'options.backupErrorData',
} as const

async function exportBackup() {
  await Promise.all([dataReady, tagsReady, settingsReady])
  const backup = buildBackup(marksByUrl.value, tagsMetadata.value, settings.value)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  a.download = `markflow-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 允许再次选择同一文件
  if (!file)
    return
  file.text()
    .then((text) => {
      let backup: BackupFile
      try {
        backup = parseBackupFile(text)
      }
      catch (err) {
        const kind = err instanceof BackupParseError ? err.kind : 'json'
        showAlert(t(backupErrorKeys[kind]))
        return
      }
      const stats = countBackupStats(backup)
      showConfirm(
        t('options.backupImportConfirm', {
          date: new Date(backup.exportedAt).toLocaleString(),
          marks: stats.marks,
          tags: stats.tags,
        }),
        () => void applyImportedBackup(backup),
      )
    })
    .catch(() => showAlert(t(backupErrorKeys.json)))
}

async function applyImportedBackup(backup: BackupFile) {
  await Promise.all([dataReady, tagsReady, settingsReady])
  const merged = applyBackup(marksByUrl.value, tagsMetadata.value, backup)
  marksByUrl.value = merged.marks
  tagsMetadata.value = merged.tags
  // 整体替换设置：既有 watch(settings, deep) 会自动把 localSettings 同步回来
  settings.value = restoredSettings(backup)
  await notifyContextsChanged()
  const markCount = Object.values(merged.marks).reduce((sum, list) => sum + list.length, 0)
  showAlert(t('options.backupImportSuccess', {
    marks: markCount,
    tags: Object.keys(merged.tags).length,
  }))
}
```

- [ ] **Step 4: 模板插入 backup section**

在 `        <!-- Error Logs -->` 注释行之前插入：

```html
        <!-- Backup & Restore -->
        <div id="backup" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            {{ t('options.backupSection') }}
          </h2>
          <p class="text-[14px] text-neutral-500 mb-[16px]">
            {{ t('options.backupDesc') }}
          </p>
          <div class="flex items-center gap-[12px]">
            <button
              class="px-[16px] py-2 text-[14px] font-medium text-neutral-900 bg-amber-500 rounded-md hover:bg-amber-600"
              @click="exportBackup"
            >
              {{ t('options.exportBackup') }}
            </button>
            <button
              class="px-[16px] py-2 text-[14px] font-medium rounded-md border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700"
              @click="fileInputRef?.click()"
            >
              {{ t('options.importBackup') }}
            </button>
            <input
              ref="fileInputRef"
              type="file"
              accept=".json,application/json"
              class="hidden"
              @change="onImportFile"
            >
          </div>
        </div>
```

- [ ] **Step 5: 验证**

Run: `npx eslint src/options/Options.vue && npm run build && npx vitest run src/tests/backup.spec.ts src/tests/i18n.spec.ts`
Expected: eslint 0 error；build 编译通过；两组测试 PASS

- [ ] **Step 6: Commit**

```bash
git add src/options/Options.vue
git commit -m "feat(backup): Options 备份与恢复区——导出下载/导入校验确认/合并落库+广播刷新"
```

---

### Task 5: 回归验证与收尾

**Files:**
- Modify: `docs/NIT_ROADMAP.md:115`、`.project/ops_changelog.md`

- [ ] **Step 1: 全量测试对照基线**

Run: `npx vitest run`
Expected: 失败清单与基线完全一致（tagTree×4 / useUIState×1 / useSidepanelData suite error），**零新增失败**

- [ ] **Step 2: lint/typecheck 触碰文件零新增**

Run: `npx eslint src/logic/backup.ts src/tests/backup.spec.ts src/options/Options.vue src/logic/i18n/locales/zh-CN.ts src/logic/i18n/locales/en.ts && npm run typecheck`
Expected: eslint 0 error；typecheck 输出的错误文件清单不含本次触碰的 5 个文件（基线错误数不变）

- [ ] **Step 3: roadmap §6 转正**

`docs/NIT_ROADMAP.md:115`：

```markdown
| **本地 JSON 备份/导入** | 产品实测分析 2026-09-10 | 已完成 | 2026-09-11（feat/local-backup）：导出 marks+tags+settings 带版本号（不含 Token）；导入复用 sync merge 合并 + settings 整体替换 |
```

- [ ] **Step 4: ops_changelog 记录**

`.project/ops_changelog.md` 表尾追加（Commit_ID 用 Task 1-5 各步实际提交哈希）：

```markdown
| 2026-09-11T{HH:mm:ss}+08:00 | FEAT | src/logic/backup.ts + src/tests/backup.spec.ts | 本地备份纯逻辑（格式/校验/合并/统计），TDD 12 测 | {hash} | git checkout HEAD -- src/logic/backup.ts src/tests/backup.spec.ts |
| 2026-09-11T{HH:mm:ss}+08:00 | FEAT | src/logic/i18n/locales/{zh-CN,en}.ts | Options 备份/导入双语词条 10 条 | {hash} | git checkout HEAD -- src/logic/i18n/locales/ |
| 2026-09-11T{HH:mm:ss}+08:00 | REFACTOR | src/options/Options.vue | 抽取 notifyContextsChanged 广播；alert 弹窗支持确认模式 | {hash} | git checkout HEAD -- src/options/Options.vue |
| 2026-09-11T{HH:mm:ss}+08:00 | FEAT | src/options/Options.vue | 备份与恢复区：导出下载/导入校验确认/合并落库+广播刷新 | {hash} | git checkout HEAD -- src/options/Options.vue |
| 2026-09-11T{HH:mm:ss}+08:00 | DOCS | docs/NIT_ROADMAP.md + .project/ops_changelog.md | 本地备份 §6 转正 + 运维记录 | {hash} | git checkout HEAD -- docs/NIT_ROADMAP.md .project/ops_changelog.md |
```

- [ ] **Step 5: Commit**

```bash
git add docs/NIT_ROADMAP.md .project/ops_changelog.md
git commit -m "docs: 本地备份收尾——roadmap §6 转正 + ops_changelog 记录"
```

---

### Task 6: 运行时验收（Layer 3 证据，生产构建）

**Files:**
- Temp: `.temp/tmp-backup-e2e.mjs`（验证后删除，不入库）

> dev 模式 content script 注入已坏（handoff §4.2），扩展 e2e 一律生产构建 + `chromium.launchPersistentContext`。

- [ ] **Step 1: 构建并编写验收脚本**

Run: `npm run build`

创建 `.temp/tmp-backup-e2e.mjs`（完整内容；先在 Node 里用真实格式构造备份文件 `.temp/tmp-backup-e2e.json`，再走 UI 导入）：

```js
// 造备份文件（marks 1 条 + tag 1 个 + 个性化设置），格式与 buildBackup 一致
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

mkdirSync('.temp', { recursive: true })
const repo = process.cwd().replace(/\\/g, '/')
const backup = {
  format: 'markflow-backup',
  version: 1,
  exportedAt: Date.now() - 86400000,
  data: {
    marks: {
      'https://example.com/': [{
        id: 'e2e-1', url: 'https://example.com/', text: 'backup mark', note: 'from backup',
        color: '#FFFF00', rangySerialized: '0:1:ser', createdAt: Date.now() - 86400000,
      }],
    },
    tags: { 'e2e-tag': { id: 'e2e-tag', name: 'E2E标签', color: '#99FF99', createdAt: Date.now() - 86400000 } },
    settings: { defaultHighlightColor: '#99CCFF', highlightHeight: 9 },
  },
}
writeFileSync('.temp/tmp-backup-e2e.json', JSON.stringify(backup))

const ctx = await chromium.launchPersistentContext(`${repo}/.temp/tmp-backup-profile`, {
  args: [`--disable-extensions-except=${repo}/extension`, `--load-extension=${repo}/extension`],
})
const page = await ctx.newPage()
await page.goto('chrome://extensions/')

// 打开 Options 页（MV3 service worker 未激活时先唤起）
const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker')
const uuid = sw.url().match(/([a-z]{32})/i)?.[1]
await page.goto(`chrome-extension://${uuid}/options/index.html`)
await page.waitForSelector('#backup', { state: 'visible' })

// 导入：隐藏 input 直接 setInputFiles → 确认弹窗 → 确定
await page.setInputFiles('#backup input[type=file]', '.temp/tmp-backup-e2e.json')
await page.waitForSelector('.fixed.inset-0', { state: 'visible' })
await page.getByRole('button', { name: /确定|OK|Confirm/ }).click()

// 断言 storage：注意 webext-settings 是 JSON 字符串（handoff §4.1 陷阱）
const [marks, tags, settingsRaw] = await sw.evaluate(async () => {
  const { 'marks-by-url-storage': m, 'webmarker-tags-metadata': t, 'webext-settings': s }
    = await chrome.storage.local.get(['marks-by-url-storage', 'webmarker-tags-metadata', 'webext-settings'])
  return [m, t, s]
})
console.log('marks ok:', marks?.['https://example.com/']?.[0]?.note === 'from backup')
console.log('tags ok:', !!tags?.['e2e-tag'])
console.log('settings ok:', JSON.parse(settingsRaw).defaultHighlightColor === '#99CCFF')
console.log('height ok:', JSON.parse(settingsRaw).highlightHeight === 9)

await ctx.close()
```

- [ ] **Step 2: 运行并核对四项断言**

Run: `node .temp/tmp-backup-e2e.mjs`
Expected: 四行 `ok: true`（marks/tags/settings/height）

- [ ] **Step 3: 清理临时产物**

```bash
Remove-Item .temp/tmp-backup-e2e.mjs, .temp/tmp-backup-e2e.json -ErrorAction SilentlyContinue
Remove-Item .temp/tmp-backup-profile -Recurse -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 4: 呈现三层证据，请求 Driver 验收**

Layer 1（lint/typecheck 触碰文件零新增）→ Layer 2（单测 12 绿 + 全量对照基线）→ Layer 3（e2e 四断言截图/日志）。
