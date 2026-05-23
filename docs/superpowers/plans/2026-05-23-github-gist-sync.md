# GitHub Gist 同步功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现基于 GitHub Gist 的标记和标签多端自动静默同步。

**Architecture:** 采用 Local-first 架构。后台 Service Worker 监听存储变化并防抖上传，启动时通过指数退避（Exponential Backoff）自动拉取。合并逻辑基于 ID 匹配和 `createdAt`/`deletedAt` 时间戳对比（最新胜出，实现删除操作的同步）。

**Tech Stack:** TypeScript, GitHub REST API, Vue 3, webextension-polyfill, Lodash-es (debounce).

---

### Task 1: 核心同步逻辑与合并算法 (含删除同步)

**Files:**
- Create: `src/logic/sync.ts`
- Create: `src/tests/sync.spec.ts`

- [ ] **Step 1: 定义同步相关接口 (增加 deletedAt)**

```typescript
// src/logic/storage.ts
export interface Mark {
  // ...
  deletedAt?: number // 用于删除同步
}
```

- [ ] **Step 2: 实现时间戳合并算法 (处理 Tombstone)**

```typescript
// src/logic/sync.ts
export function mergeMarks(local: Record<string, Mark[]>, remote: Record<string, Mark[]>): Record<string, Mark[]> {
  // 比较 Math.max(createdAt, deletedAt || 0) 保留最新
}
```

- [ ] **Step 3: 编写并运行合并测试 (含删除验证)**

运行: `npx vitest src/tests/sync.spec.ts --run`

- [ ] **Step 4: 实现 GitHub API 封装 (含细化错误处理)**
处理 401 (无效) 和 403 (权限不足) 状态码。

- [ ] **Step 5: 提交代码**

```bash
git add src/logic/sync.ts src/tests/sync.spec.ts
git commit -m "feat: 实现核心合并逻辑与 GitHub API 封装"
```

---

### Task 2: 配置存储与 Options UI

**Files:**
- Modify: `src/logic/storage.ts`
- Modify: `src/options/Options.vue`

- [ ] **Step 1: 增加同步配置项**

```typescript
// src/logic/storage.ts
export interface SyncConfig {
  enabled: boolean
  token: string
  gistId: string
  lastSyncTime: number
  autoSync: boolean
}

export const { data: syncConfig, dataReady: syncReady } = useWebExtensionStorage<SyncConfig>(
  'webmarker-sync-config',
  { enabled: false, token: '', gistId: '', lastSyncTime: 0, autoSync: true }
)
```

- [ ] **Step 2: 在 Options 页面添加同步控制面板**

```vue
<!-- src/options/Options.vue -->
<div class="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 mt-6">
  <h2 class="text-lg font-bold mb-4">GitHub 同步</h2>
  <div class="space-y-4">
    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium">GitHub Personal Access Token (PAT)</label>
      <input v-model="syncConfig.token" type="password" class="..." placeholder="ghp_xxxxxxxx" />
      <p class="text-xs text-gray-500">
        需要勾选 'gist' 权限。查看 <a href="/docs/user-guide/github-sync.md" class="text-blue-500 underline">配置指南</a>
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button @click="connectSync" class="px-4 py-2 bg-blue-600 text-white rounded">测试并连接</button>
      <span v-if="syncConfig.gistId" class="text-green-500 text-sm">已连接到 Gist: {{ syncConfig.gistId }}</span>
    </div>
  </div>
</div>
```

- [ ] **Step 3: 实现 `connectSync` 逻辑 (自动查找或创建 Gist)**

```typescript
// src/options/Options.vue <script>
async function connectSync() {
  // 1. 获取 Gists 列表
  // 2. 查找包含 markflow_sync.json 的 Gist
  // 3. 找到则保存 gistId，未找到则创建新的 Secret Gist
}
```

- [ ] **Step 4: 提交代码**

```bash
git add src/logic/storage.ts src/options/Options.vue
git commit -m "feat: 添加同步配置 UI 与存储"
```

---

### Task 3: 后台自动同步引擎 (含重试逻辑)

**Files:**
- Modify: `src/background/main.ts`

- [ ] **Step 1: 实现 Debounced Push 逻辑**

- [ ] **Step 2: 实现启动时指数退避拉取**

```typescript
async function performPull(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // ...
      return
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
    }
  }
}
```

- [ ] **Step 3: 提交代码**

```bash
git add src/background/main.ts
git commit -m "feat: 实现后台自动防抖同步"
```

---

### Task 4: 用户指南与权限更新

**Files:**
- Create: `docs/user-guide/github-sync.md`
- Modify: `src/manifest.ts`

- [ ] **Step 1: 编写 GitHub 同步图文指南**
说明 Token 获取步骤和安全注意事项。

- [ ] **Step 2: 添加 `unlimitedStorage` 权限**

```typescript
// src/manifest.ts
permissions: ['tabs', 'storage', 'activeTab', 'sidePanel', 'unlimitedStorage'],
```

- [ ] **Step 3: 提交代码**

```bash
git add docs/user-guide/github-sync.md src/manifest.ts
git commit -m "docs: 添加同步指南；feat: 增加无限存储权限"
```

---

### Task 5: 最终验证与清理

- [ ] **Step 1: 模拟多端合并验证**
手动修改 Gist 内容，验证插件是否能正确拉取并合并时间戳更新的数据。
- [ ] **Step 2: 检查控制台报错**
确保网络异常时有错误捕获，不会阻塞插件其他功能。
