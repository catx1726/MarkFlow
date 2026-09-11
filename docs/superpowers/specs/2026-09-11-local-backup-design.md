# 本地 JSON 备份/导入设计

- **日期**: 2026-09-11
- **来源**: `docs/NIT_ROADMAP.md` §3「本地 JSON 备份/导入」（产品实测分析 2026-09-10，⭐⭐⭐⭐⭐，P0）；handoff `coach-tip-closeout-2026-09-11.md` §3
- **状态**: 已批准（Driver 2026-09-11，brainstorm 三项决策确认）

## 1. 问题与目标

「本地优先」缺「本地可备份」这条腿：不使用 GitHub 同步的用户，卸载浏览器/扩展即丢全部数据。而侧边栏备注、标签、组织结构是**不可再生数据**（标记本身可回网页重做，但备注与归类不能）。

目标：Options 提供全量导出（单文件 JSON，带版本号）与导入（格式校验 + 合并），让用户可以脱离 GitHub 完成数据备份与恢复。

**成功标准**：
1. 导出单文件 JSON：marks + tags + settings，带格式标识与版本号，**不含任何密钥**（syncConfig/token 不进备份）
2. 导入先校验：坏文件给出可理解的双语错误且**不写任何存储**；合法文件经确认后应用
3. marks/tags 复用 `sync.ts` 的 merge 语义（时间戳新者胜）——**不丢现有数据**；settings 整体恢复（旧备份缺新字段由默认值补齐）
4. 导入后侧边栏与已打开页面即时刷新（复用既有广播链路）
5. 中英双语；触碰文件零新增 lint / typecheck / test 错误（基线债务见 handoff §4.3）

## 2. 决策记录

| 决策点 | 结论 | 备选与理由 |
| :--- | :--- | :--- |
| 导出范围 | marks + tags + settings（`webext-settings`），**排除 syncConfig** | 备选「全量含 token」被否：安全规范红线——密钥不落盘外发；备份文件一旦泄露，攻击者可写用户 Gist。换机后重连 GitHub 只需重新粘贴一次 token |
| 导入合并语义 | marks/tags 复用 `mergeMarks`/`mergeTags`；settings 整体替换 | 备选「逐字段合并」≈ 整体替换（导出总是全量），徒增复杂度；「拆字段：数据恢复、偏好保留」用户视角「为什么只恢复一半」难解释 |
| UI 位置 | 独立「备份与恢复」section，置于 GitHub Sync 与 Error Logs 之间 | 备选「并入 GitHub Sync」被否：混淆「云」与「本地」概念；独立 section 突出「不用同步也有备份」的本地优先卖点 |
| 导入确认交互 | 解析成功后弹确认弹窗（展示备份元信息 + 覆盖警告），确认才应用 | 直接应用风险高（settings 被覆盖不可逆）；`window.confirm` 与项目弹窗风格不符 |
| 版本策略 | `version: 1`；导入接受 `1 ≤ version ≤ BACKUP_VERSION`，更高版本拒绝并提示「来自更新版本」 | 前向兼容留给未来格式演进 |

## 3. 架构设计

### 3.1 备份文件格式（`src/logic/backup.ts`）

```ts
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
```

- 文件名 `markflow-backup-YYYYMMDD-HHmmss.json`（本地时间，两位补零，如 `markflow-backup-20260911-1530.json`）
- JSON 序列化 `JSON.stringify(file, null, 2)`（人类可读，也便于用户检查）

### 3.2 纯函数（全部可单测，无 IO）

| 函数 | 职责 |
| :--- | :--- |
| `buildBackup(marks, tags, settings): BackupFile` | 聚合三块数据 + `exportedAt: Date.now()` |
| `parseBackupFile(text): BackupFile` | 严格校验，失败抛 `BackupParseError`（携带 i18n key）。校验链：JSON 可解析 → `format === BACKUP_FORMAT` → `version` 为整数且 `1 ≤ v ≤ BACKUP_VERSION` → `data` 为对象且 `marks`/`tags`/`settings` 均为对象（允许空对象） |
| `applyBackup(localMarks, localTags, backup): { marks, tags }` | 复用 `sync.ts` 的 `mergeMarks`/`mergeTags`（时间戳新者胜，与 Gist 同步同一收敛语义） |
| `restoredSettings(backup): Settings` | `{ ...defaultSettings, ...backup.data.settings }`——旧备份缺新字段由默认值补齐，防止未来版本字段缺失 |
| `countBackupStats(backup): { marks, tags }` | 标记总数（跨 URL 求和，含已删除标记）与标签数，供确认弹窗展示 |

### 3.3 Options UI（`Options.vue`）

- `navItems` 新增 `{ id: 'backup', label: 'options.backupSection' }`，section 模板置于 `github-sync` 与 `error-logs` 之间
- **导出按钮**：`await Promise.all([dataReady, tagsReady, settingsReady])` → `buildBackup(marksByUrl.value, tagsMetadata.value, settings.value)` → Blob 下载（复用 `exportLogs` 的 `a.click()` 模式）
- **导入按钮**：触发隐藏 `<input type="file" accept=".json,application/json">` → `FileReader` 读文本 → `parseBackupFile` → 失败弹 i18n 错误；成功弹**确认弹窗**（见 3.4）→ 确认后：
  1. `marksByUrl.value` / `tagsMetadata.value` ← `applyBackup(...)` 结果
  2. `settings.value` ← `restoredSettings(backup)`（既有 `watch(settings, deep)` 自动把 `localSettings` 同步回来，先例：`reshowCoachTip` 直写全局 settings）
  3. 广播刷新（复用 `saveSettings` 尾部逻辑，抽公共函数 `notifyContextsChanged()`：`refresh-sidepanel-data` → background + 逐 tab `refresh-highlights`）
  4. 成功 alert 展示导入统计（合并后标记数/标签数）

### 3.4 确认弹窗（既有 alert 弹窗扩展）

`alertInfo` 增加可选 `onConfirm` 回调：有回调时弹窗显示「取消」（`common.cancel`，已存在）+「确定」（`common.confirm`，已存在）双按钮；点取消或遮罩关闭不应用。确认弹窗内容：

- 备份导出时间（`exportedAt` → `toLocaleString()`）
- 标记 N 条 / 标签 M 个（`countBackupStats`）
- 警告行：「导入将合并标记与标签（不删除现有数据），并**覆盖当前全部设置**」

### 3.5 i18n 词条（`options.*`，双语同构）

| key | zh-CN | en |
| :--- | :--- | :--- |
| `backupSection` | 备份与恢复 | Backup & Restore |
| `backupDesc` | 将标记、标签与设置导出为本地 JSON 文件，或从备份文件恢复。不包含 GitHub Token。 | Export marks, tags and settings to a local JSON file, or restore from a backup. GitHub Token is never included. |
| `exportBackup` | 导出备份 | Export Backup |
| `importBackup` | 导入备份 | Import Backup |
| `backupImportConfirm` | 备份导出于 {date}，含 {marks} 条标记、{tags} 个标签。导入将合并标记与标签（不删除现有数据），并覆盖当前全部设置。 | Backup exported on {date} with {marks} marks and {tags} tags. Importing merges marks and tags (existing data is kept) and replaces all current settings. |
| `backupImportSuccess` | 导入完成：当前共 {marks} 条标记、{tags} 个标签，设置已恢复 | Import complete: {marks} marks, {tags} tags, settings restored |
| `backupErrorJson` / `backupErrorFormat` / `backupErrorVersion` / `backupErrorData` | 文件不是有效 JSON / 不是 MarkFlow 备份文件 / 备份来自更新版本 / 备份数据不完整 | （同构英文） |

## 4. 数据流

```
导出：Options → dataReady 三者 → buildBackup → Blob → markflow-backup-*.json（落用户磁盘）

导入：用户选文件 → FileReader(text) → parseBackupFile
        ├─ 校验失败 → showAlert(i18n 错误)（不写存储）
        └─ 成功 → 确认弹窗（元信息+警告）
              ├─ 取消 → 关闭，无副作用
              └─ 确认 → applyBackup（merge）→ 写三个 storage 单例
                        → notifyContextsChanged（sidepanel + 各 tab content script 刷新）
                        → 成功 alert（统计）
```

## 5. 错误处理与边界

| 场景 | 行为 |
| :--- | :--- |
| 坏 JSON / 错 format / version 过高 / data 缺字段 | i18n 错误弹窗，**不写任何存储** |
| 空标记库导出 | 正常（空对象合法），导入空备份等于「只恢复设置」 |
| 导入与 Gist 同步共存 | merge 语义与 Gist 相同（时间戳新者胜），导入后本地变新，下次 autoSync 推送自然携带恢复数据，多端一致收敛，无特判 |
| 大备份文件 | 万级标记约数 MB；同步 `JSON.parse` 阻塞极短，可接受 |
| 确认弹窗期间编辑设置未保存 | 导入替换 settings 后 `watch` 同步 `localSettings`，未保存编辑被覆盖——确认弹窗已有明确警告，预期行为（恢复优先） |
| e2e 种子陷阱 | `webext-settings` 在 storage.local 中是 JSON 字符串（handoff §4.1）；e2e 断言须经 `useWebExtensionStorage` 或手动 `JSON.parse` |

## 6. 测试策略（TDD，先红后绿）

- **纯逻辑单测** `src/tests/backup.spec.ts`（vitest，与既有 26 个 spec 同构）：
  - `buildBackup`：字段完整、`format`/`version`/`exportedAt` 正确
  - `parseBackupFile` 快乐路径（`buildBackup` 产物 roundtrip）
  - 拒绝路径：非 JSON / `format` 不符 / `version` 非整数或 < 1 / `version > BACKUP_VERSION` / `data` 非对象 / `data.marks` 非对象
  - `applyBackup`：复用 merge 语义——同 id 不同时间戳取新者；本地独有的 URL/标记保留
  - `restoredSettings`：旧备份缺新字段 → 默认值补齐；备份值覆盖同名默认
  - `countBackupStats`：跨 URL 求和正确
  - i18n：新增词条中英双语句式完整（回归 `i18n.spec.ts` 既有同构校验）
- **回归**：`npm run test` 触碰文件零新增失败；lint / typecheck 零新增错误
- **e2e（验收，可选）**：生产构建 + `chromium.launchPersistentContext`（handoff §5 模式）：造标记 → 导出 → 清库 → 导入 → 标记与设置恢复

## 7. 变更文件清单

| 文件 | 变更 |
| :--- | :--- |
| `src/logic/backup.ts` | 新增：格式常量 + 5 个纯函数 + `BackupParseError` |
| `src/tests/backup.spec.ts` | 新增：单测 |
| `src/options/Options.vue` | backup section + navItem + 导入导出逻辑 + alert 弹窗 confirm 模式 + `notifyContextsChanged` 抽取 |
| `src/logic/i18n/locales/zh-CN.ts` / `en.ts` | `options.backup*` 词条 |
| `docs/NIT_ROADMAP.md` | §6 Active Work 增行（完成后转正） |

## 8. 不做的事（YAGNI）

- 不导出 syncConfig（token/gistId/enabled）——密钥红线
- 不做选择性导入（只导标记不导设置）
- 不做自动定时备份或备份提醒
- 不做加密备份
- 不做 Firefox/Chromium 格式差异处理（同一份 JSON 天然互通）
