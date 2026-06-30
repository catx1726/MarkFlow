# MarkFlow 同步机制深度解析

本文档为开发者提供 MarkFlow 跨设备同步方案的技术细节，介绍我们如何在 Local-first 前提下，利用 GitHub Gist 构建一个具备冲突解决能力、MV3 兼容且健壮的多端同步系统。

## 1. 设计哲学：Local-first

我们坚持“本地优先”原则：
- **离线可用**：所有数据首先存储在浏览器的 `storage.local` 中，无需联网即可操作。
- **极致速度**：高亮的渲染和读取不经过网络，仅操作本地索引。
- **云端为辅**：GitHub Gist 仅作为数据交换的“记事本”和备份，不参与实时逻辑。
- **默认不同步**：同步是可选功能，用户需要主动在设置页配置 Token 并连接。

## 2. 核心架构

### 2.1 存储载体：GitHub Gist

选择 Gist 而非 Repository 的原因：
- **API 极简**：单一文件的读写仅需一个 PATCH/GET 请求。
- **隐私隔离**：支持 Secret Gist，不出现在用户的公共仓库列表中。
- **免维护**：利用 GitHub 现成的版本管理和鉴权体系。

数据以私有 Gist 中的 `markflow_sync.json` 文件为载体，文件内容是一个 JSON 对象：

```json
{
  "marks": { "https://example.com": [ /* Mark[] */ ] },
  "tags": { "tag-xxx": { /* Tag */ } },
  "lastSync": 1750000000000
}
```

**注意**：GitHub `/gists` 列表接口返回的文件对象**不包含 `content`**，必须通过 `GET /gists/{id}` 读取完整内容。因此同步实现使用 `getGistById(token, gistId)` 而非依赖列表接口。

### 2.2 数据组织：Tombstone (墓碑机制)

在分布式系统中，物理删除是危险的，因为离线设备无法得知某个记录是被删除了还是从未存在过。
- **`deletedAt` 字段**：当用户删除标记时，我们不立即物理删除，而是打上 `deletedAt` 时间戳。
- **同步合并**：合并时，对比本地与远程的 `createdAt` 和 `deletedAt`，保留时间戳最新（最大）的版本。
- **物理清理 (Purge)**：在同步成功（确认云端已感知删除）或拉取合并后，本地会自动扫描并移除所有超过 7 天且带有 `deletedAt` 的记录，保持存储精简。

## 3. 同步流程 (Sync Pipeline)

### 3.1 队列与职责分离

同步系统使用两个队列：

- **`enqueueSync`**：串行化所有同步操作（Push / Pull），防止并发同步导致数据覆盖。`isSyncing` 标志用于快速拒绝新的同步任务。
- **`enqueueWrite`**：串行化对 `marksByUrl` / `tagsMetadata` 的写入，避免多个写入源同时修改本地数据。

```typescript
let syncQueue: Promise<void> = Promise.resolve()

async function enqueueSync(task: () => Promise<void>) {
  const nextSync = syncQueue.then(task).catch((err) => {
    console.error('[Sync] Queue task failed:', err)
  })
  syncQueue = nextSync
  return nextSync
}
```

为消除 `enqueueSync` 嵌套导致的死锁风险，拉取逻辑被拆分为两层：

- **`performPullInternal`**：执行实际拉取和写入，**不**调用 `enqueueSync`。调用方必须已在 `enqueueSync` 内部并持有 `isSyncing` 锁。
- **`performPull`**：`enqueueSync` 包装，供外部调用。

### 3.2 首次连接：Pull-then-Enable

在 `Options.vue` 的 `connectSync` 中，找到现有 Gist 后：

1. 先调用 `triggerPull({ force: true, token, gistId })` 拉取并合并远程数据。
2. 拉取成功后，再设置 `syncConfig.enabled = true`。
3. 若拉取失败，重置 `syncConfig.gistId = ''`，保持同步禁用并提示用户。

该顺序确保本地空数据不会覆盖云端已有数据。

### 3.3 自动同步触发器

- **防抖推送 (Debounced Push)**：监听本地存储变化，设置 10 秒防抖窗口。用户连续标记时不会频繁请求 API。
- **启动拉取**：`browser.runtime.onStartup` 触发，若同步已启用则自动执行一次拉取。
- **手动拉取**：`trigger-sync` 消息支持 `force` 参数，允许在 `enabled = false` 时执行强制拉取。

### 3.4 MV3 消息可靠性

Manifest V3 的 Service Worker 可能被回收，`webext-bridge` 的 `sendMessage` 在某些情况下不返回响应。为此：

- `triggerPull` 先尝试 `webext-bridge`，超时后 fallback 到原生 `browser.runtime.sendMessage({ type: 'trigger-sync-pull', ... })`。
- Background 同时监听 `onMessage('trigger-sync')` 和 `browser.runtime.onMessage` 两种入口。
- 发送同步消息前调用 `browser.runtime.getPlatformInfo()` 尝试唤醒 Service Worker。

### 3.5 跨 Context Storage 同步延迟

`syncConfig` 通过 VueUse Storage 在多个扩展上下文（Options / Background / Content Script）之间同步，但**不是即时同步**。因此在 `triggerPull` 中显式将 `token` 和 `gistId` 作为消息参数传给 Background，Background 的 `performPullInternal` 优先使用消息参数，fallback 到 `syncConfig.value`。

## 4. 冲突解决策略

我们采用 **LWW (Last Write Wins)** 策略。
每个 Mark 拥有唯一 ID。合并逻辑如下：
1. 遍历远程数据。
2. 若本地无此 ID -> 新增。
3. 若两端均有此 ID -> 取 `Math.max(createdAt, deletedAt)` 较大者作为最终态。
4. 物理清理所有标记为已删除且已合并的记录。

合并操作由 `mergeWithRemoteFile` 封装，它会处理 `JSON.parse` 异常、空内容等边界情况。

## 5. 错误处理与恢复

### 5.1 推送门控 (`canPush`)

`performPush` 只有在以下条件下才会执行：
- `syncConfig.enabled === true`
- `token` 和 `gistId` 都存在
- `lastSyncStatus !== 'none'`（即至少成功完成过一次拉取）

### 5.2 错误恢复冷却

若上次同步状态为 `error`，下次推送前会先执行一次 `performPullInternal` 拉取合并，避免覆盖远程较新数据。为防止连续失败导致循环，引入 60 秒冷却期：

```typescript
if (Date.now() - lastErrorRecoveryAt < ERROR_RECOVERY_COOLDOWN_MS) {
  console.warn('[Sync] Error recovery cooldown active, skipping push')
  return
}
```

### 5.3 空远程文件

当远程 `markflow_sync.json` 存在但 `content` 为空时，视为首次同步。系统会：
- 将 `lastSyncStatus` 标记为 `success`。
- 提示用户“云端同步文件为空，本地数据将在下次变更时上传”。
- 不清空本地数据，也不强制推送。

## 6. 安全考量

- **最小权限**：引导用户生成仅勾选 `gist` 权限的 Token。
- **加密存储**：Token 存储在扩展私有的 `storage.local` 中。
- **过期处理**：系统会自动捕获 GitHub 的 401 错误，并在 UI 提示“身份验证失败”，同时自动暂停同步以保护账户安全。
- **Payload 大小监控**：同步前检查数据包大小，超过 8MB 记录警告，接近 GitHub 10MB 上限时提示用户清理。

## 7. 关键文件

- `src/logic/sync.ts`：`getGists`, `getGistById`, `createGist`, `updateGist`, `mergeMarks`, `mergeTags`, `mergeWithRemoteFile`, `canPush`
- `src/background/main.ts`：`performPush`, `performPull`, `performPullInternal`, `enqueueSync`, `enqueueWrite`
- `src/options/Options.vue`：`connectSync`, `triggerPull`, `withTimeout`
- `src/tests/sync.spec.ts`：同步相关单元测试

---
*为开发者而生，让知识流动。*
