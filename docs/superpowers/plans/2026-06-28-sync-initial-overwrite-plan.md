# 修复初始同步时 Gist 数据被本地数据覆盖 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复首次连接已有 Gist 时，本地数据可能覆盖远程数据的问题；通过「先拉取合并再启用同步」+「推送安全门」双保险防止数据丢失。

**Architecture:** 在 `src/logic/sync.ts` 中新增可单元测试的纯函数 `canPush`（推送前置条件）与 `mergeWithRemoteFile`（解析远程 Gist 文件并合并到本地）。`src/background/main.ts` 的 `performPush` 使用 `canPush` 增加安全门；`performPull` 支持 `force` 参数供 Options 在启用前调用。`src/options/Options.vue` 的 `connectSync` 改为：找到已有 Gist → 强制拉取合并 → 成功后再设置 `enabled = true`。

**Tech Stack:** Vue 3, TypeScript, webext-bridge, webextension-polyfill, Vitest

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/logic/sync.ts` | 新增 `canPush`、`mergeWithRemoteFile` 纯函数 |
| `src/tests/sync.spec.ts` | 新增 `canPush`、`mergeWithRemoteFile` 单元测试 |
| `src/background/main.ts` | `performPush` 增加 `canPush` 门控；`performPull` 支持 `force`；`trigger-sync` 改为强制拉取 |
| `src/options/Options.vue` | `connectSync` 先强制拉取合并，再启用同步 |

---

## Task 1: 新增推送安全门 `canPush`

**Files:**
- Modify: `src/logic/sync.ts:1-17`
- Test: `src/tests/sync.spec.ts`

- [ ] **Step 1: 编写失败测试**

在 `src/tests/sync.spec.ts` 末尾新增：

```typescript
import { canPush } from '../logic/sync'
import type { SyncConfig, SyncStatus } from '../logic/storage'

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

  it('启用、配置完整且已成功同步过时可以推送', () => {
    expect(canPush(baseConfig, baseStatus)).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
corepack pnpm vitest run src/tests/sync.spec.ts
```

Expected: FAIL，提示 `canPush` 未导出。

- [ ] **Step 3: 实现最小代码**

在 `src/logic/sync.ts` 中新增：

```typescript
import type { SyncConfig, SyncStatus } from './storage'

export function canPush(config: SyncConfig, status: SyncStatus): boolean {
  return config.enabled
    && !!config.token
    && !!config.gistId
    && status.lastSyncStatus !== 'none'
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
corepack pnpm vitest run src/tests/sync.spec.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/logic/sync.ts src/tests/sync.spec.ts
git commit -m "feat(sync): add canPush guard to prevent push before initial pull"
```

---

## Task 2: 新增 `mergeWithRemoteFile` 辅助函数

**Files:**
- Modify: `src/logic/sync.ts`
- Test: `src/tests/sync.spec.ts`

- [ ] **Step 1: 编写失败测试**

在 `src/tests/sync.spec.ts` 中新增：

```typescript
import { mergeWithRemoteFile } from '../logic/sync'

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

  it('远程字段缺失时应视为空对象', () => {
    const localMarks = { url1: [{ id: '1', text: 'local', createdAt: 100 } as Mark] }
    const result = mergeWithRemoteFile(localMarks, {}, JSON.stringify({ lastSync: 1 }))
    expect(result.marks.url1[0].id).toBe('1')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
corepack pnpm vitest run src/tests/sync.spec.ts
```

Expected: FAIL，提示 `mergeWithRemoteFile` 未导出。

- [ ] **Step 3: 实现最小代码**

在 `src/logic/sync.ts` 中新增：

```typescript
export function mergeWithRemoteFile(
  localMarks: Record<string, Mark[]>,
  localTags: Record<string, Tag>,
  fileContent: string | undefined,
): { marks: Record<string, Mark[]>, tags: Record<string, Tag> } {
  if (!fileContent?.trim()) {
    return { marks: localMarks, tags: localTags }
  }
  const remoteData = JSON.parse(fileContent) as Partial<SyncData>
  return {
    marks: mergeMarks(localMarks, remoteData.marks || {}),
    tags: mergeTags(localTags, remoteData.tags || {}),
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
corepack pnpm vitest run src/tests/sync.spec.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/logic/sync.ts src/tests/sync.spec.ts
git commit -m "feat(sync): add mergeWithRemoteFile helper for initial gist merge"
```

---

## Task 3: 后台 `performPush` 使用 `canPush` 安全门

**Files:**
- Modify: `src/background/main.ts:514-518`

- [ ] **Step 1: 导入 `canPush`**

修改现有导入：

```typescript
import { canPush, getGists, mergeMarks, mergeTags, updateGist } from '~/logic/sync'
```

- [ ] **Step 2: 在 `performPush` 开头增加门控**

将：

```typescript
const performPush = debounce(async () => {
  if (isSyncing || !syncConfig.value.enabled || !syncConfig.value.token || !syncConfig.value.gistId)
    return
```

改为：

```typescript
const performPush = debounce(async () => {
  if (isSyncing || !canPush(syncConfig.value, syncStatus.value))
    return
```

- [ ] **Step 3: Commit**

```bash
git add src/background/main.ts
git commit -m "fix(sync): guard performPush with canPush to skip before initial pull"
```

---

## Task 4: 后台支持强制拉取

**Files:**
- Modify: `src/background/main.ts:407-409`、`src/background/main.ts:585-590`

- [ ] **Step 1: `trigger-sync` 改为强制拉取**

将：

```typescript
onMessage('trigger-sync', async () => {
  await performPull()
})
```

改为：

```typescript
onMessage('trigger-sync', async () => {
  await performPull(3, { force: true })
})
```

- [ ] **Step 2: `performPull` 增加 `force` 参数**

将函数签名与启用检查：

```typescript
async function performPull(retries = 3) {
  if (isSyncing)
    return
  await ensureReady()
  if (!syncConfig.value.enabled || !syncConfig.value.token || !syncConfig.value.gistId)
    return
```

改为：

```typescript
async function performPull(retries = 3, { force = false } = {}) {
  if (isSyncing)
    return
  await ensureReady()
  const hasRequired = syncConfig.value.token && syncConfig.value.gistId
  if (!hasRequired)
    return
  if (!force && !syncConfig.value.enabled)
    return
```

- [ ] **Step 3: Commit**

```bash
git add src/background/main.ts
git commit -m "feat(sync): support force pull for pre-enable merge"
```

---

## Task 5: Options.vue 先拉取合并再启用同步

**Files:**
- Modify: `src/options/Options.vue:11`、`src/options/Options.vue:119-158`

- [ ] **Step 1: 导入 `mergeWithRemoteFile`**

将：

```typescript
import { createGist, getGists } from '~/logic/sync'
```

改为：

```typescript
import { createGist, getGists, mergeWithRemoteFile } from '~/logic/sync'
```

- [ ] **Step 2: 修改 `connectSync` 中连接现有 Gist 的分支**

将：

```typescript
if (existingGist) {
  syncConfig.value.gistId = existingGist.id
  syncConfig.value.enabled = true
  showAlert('已成功连接到现有的同步 Gist！')
}
```

改为：

```typescript
if (existingGist) {
  syncConfig.value.gistId = existingGist.id
  // 先强制拉取并合并远程数据，再启用自动同步，防止本地空数据覆盖远程
  await sendMessage('trigger-sync', {}, 'background')
  syncConfig.value.enabled = true
  showAlert('已成功连接到现有的同步 Gist！')
}
```

并移除函数末尾冗余的 `await sendMessage('trigger-sync', {}, 'background')` 调用（或者保留，因为启用后再次拉取是安全的；推荐移除以避免重复拉取）。

当前代码在 `finally` 之前还有一行：

```typescript
// 成功连接后触发一次全量拉取合并
await sendMessage('trigger-sync', {}, 'background')
```

这一行应删除。

- [ ] **Step 3: Commit**

```bash
git add src/options/Options.vue
git commit -m "fix(options): pull and merge before enabling sync on existing gist"
```

---

## Task 6: 验证与闭环

**Files:**
- 运行测试

- [ ] **Step 1: 运行新增及同步相关测试**

```bash
corepack pnpm vitest run src/tests/sync.spec.ts
```

Expected: PASS（包括 `canPush` 与 `mergeWithRemoteFile`）。

- [ ] **Step 2: 运行全量测试并记录基线失败**

```bash
corepack pnpm vitest run
```

Expected: 原有失败用例数量不变，新增的同步测试全部通过。

- [ ] **Step 3: 类型检查与 Lint**

```bash
corepack pnpm typecheck
corepack pnpm lint
```

修复由本次改动引入的错误；不修复预先存在的失败。

- [ ] **Step 4: 更新 NIT_ROADMAP（如需要）**

如果项目使用 `docs/NIT_ROADMAP.md` 跟踪任务，追加一行：

```markdown
- [ ] fix/sync-initial-pull-overwrite: 修复初始同步覆盖远程 Gist 数据
```

- [ ] **Step 5: 提交最终调整并推送**

```bash
git add -A
git commit -m "chore(docs): update roadmap for sync overwrite fix"
git push -u origin fix/sync-initial-pull-overwrite
```

---

## Self-Review

| 规格要求 | 对应任务 |
| --- | --- |
| 连接现有 Gist 先拉取合并再启用 | Task 4 + Task 5 |
| 推送增加安全门 | Task 1 + Task 3 |
| 后台支持强制拉取 | Task 4 |
| 单元测试覆盖 | Task 1 + Task 2 |
| 不改动合并算法 | 未修改 `mergeMarks`/`mergeTags` |
