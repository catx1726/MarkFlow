# 存储竞争条件修复实施计划 (Storage Race Condition Fix)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 MV3 环境下后台脚本重启导致的数据丢失风险，确保存储读取完成前不处理业务请求，并禁用危险的初始化回写。

**Architecture:** 
1. 存储层：默认禁用 `writeDefaults`，使初始化变为纯读。
2. 后台层：建立 `ensureReady` 聚合守卫，所有写操作处理器必须 `await`。
3. 配置层：移除非标准清单字段。

**Tech Stack:** TypeScript, WebExtensions API, Vue (Refs/Composables), Vitest

---

### Task 1: 存储层加固 (useWebExtensionStorage)

**Files:**
- Modify: `src/composables/useWebExtensionStorage.ts`
- Test: `src/tests/state.spec.ts` (或创建新测试)

- [ ] **Step 1: 编写失败测试**
  验证在存储为空时，默认情况下不再调用 `setItem`。
  ```typescript
  // 在 src/tests/storage-fix.spec.ts 中
  import { it, expect, vi, describe } from 'vitest'
  import { useWebExtensionStorage } from '../composables/useWebExtensionStorage'
  import { storage } from 'webextension-polyfill'

  describe('Storage Fix', () => {
    it('should NOT write default values to storage during initialization by default', async () => {
      vi.mocked(storage.local.get).mockResolvedValue({})
      const setSpy = vi.spyOn(storage.local, 'set')
      
      const { dataReady } = useWebExtensionStorage('test-key', { a: 1 })
      await dataReady
      
      expect(setSpy).not.toHaveBeenCalled()
    })
  })
  ```

- [ ] **Step 2: 运行测试并确认失败**
  运行: `npx vitest src/tests/storage-fix.spec.ts`
  期望结果: FAIL (因为当前 `writeDefaults` 默认为 `true`，会调用 `set`)

- [ ] **Step 3: 修改实现**
  修改 `src/composables/useWebExtensionStorage.ts`:
  ```typescript
  // 修改默认解构值
  const {
    // ... 其他选项
    writeDefaults = false, // 从 true 改为 false
    // ...
  } = options
  ```

- [ ] **Step 4: 运行测试并确认通过**
  运行: `npx vitest src/tests/storage-fix.spec.ts`
  期望结果: PASS

- [ ] **Step 5: 提交**
  ```bash
  git add src/composables/useWebExtensionStorage.ts
  git commit -m "refactor: disable writeDefaults by default in storage composable"
  ```

---

### Task 2: 后台消息守卫实现 (Background Guards)

**Files:**
- Modify: `src/background/main.ts`

- [ ] **Step 1: 定义聚合守卫**
  在 `src/background/main.ts` 导入部分下方添加：
  ```typescript
  const ensureReady = async () => {
    await Promise.all([dataReady, tagsReady, syncReady, statusReady])
  }
  ```

- [ ] **Step 2: 应用守卫到 add-mark**
  ```typescript
  onMessage('add-mark', async ({ data }) => {
    await ensureReady() // 添加此行
    try {
      // ... 原有逻辑
    }
  })
  ```

- [ ] **Step 3: 应用守卫到 remove-mark 相关处理器**
  包括 `remove-mark` 和 `remove-mark-by-id`。
  ```typescript
  onMessage('remove-mark', async ({ data: markToRemove }) => {
    await ensureReady()
    // ...
  })

  onMessage<RemoveMarkPayload>('remove-mark-by-id', async ({ data }) => {
    await ensureReady()
    // ...
  })
  ```

- [ ] **Step 4: 应用守卫到其他写操作处理器**
  包括 `update-mark-note` 和 `sync-now` (如果存在)。
  
- [ ] **Step 5: 提交**
  ```bash
  git add src/background/main.ts
  git commit -m "feat: add initialization guards to background message handlers"
  ```

---

### Task 3: 清单文件清理 (Manifest Cleanup)

**Files:**
- Modify: `src/manifest.ts`

- [ ] **Step 1: 移除非标准字段**
  移除 `getManifest` 函数中 Firefox 特定配置下的 `data_collection_permissions` 块。

- [ ] **Step 2: 验证 Manifest 生成**
  运行: `npm run build` (或仅运行相关的 manifest 生成脚本)
  检查 `dist/manifest.json` 是否不再包含该字段。

- [ ] **Step 3: 提交**
  ```bash
  git add src/manifest.ts
  git commit -m "fix: remove non-standard data_collection_permissions from manifest"
  ```

---

### Task 4: 最终验证 (Final Verification)

- [ ] **Step 1: 运行所有测试**
  运行: `npm test`
  期望结果: 全部 PASS

- [ ] **Step 2: 手动检查数据流**
  在浏览器中加载扩展，添加一个高亮，重启后台脚本，确认数据依然存在。
