严重问题 (Blocking)
1. 潜在的死锁风险：enqueueSync 嵌套 enqueueWrite

文件: src/background/main.ts

问题: 在 performPush 和 performPull 中，enqueueSync 内部又调用了 enqueueWrite。如果 enqueueWrite 和 enqueueSync 共享相同的 Promise 链机制，可能导致死锁或意外的执行顺序。

// performPush 中
await enqueueSync(async () => {
  // ...
  await enqueueWrite(async () => {  // 潜在问题
    syncConfig.value.lastSyncTime = Date.now()
    await purgeTombstones()
  })
})

建议: 明确 enqueueSync 和 enqueueWrite 的关系。如果它们是独立的队列，需要确保不会互相阻塞。考虑将同步操作和写入操作合并到同一个队列中，或者使用更高级的并发控制机制（如 Mutex）。
2. purgeTombstones 在同步未启用时的调用时机问题

文件: src/background/main.ts

问题: 在 remove-mark、remove-mark-by-id 等消息处理器中，当 syncConfig.value.enabled 为 false 时立即调用 purgeTombstones()。但此时删除操作刚刚设置了 deletedAt，立即清理会导致这些标记被物理删除，而如果用户稍后开启同步，这些删除操作将无法同步到其他设备。

// 在 remove-mark 中
if (!syncConfig.value.enabled) await purgeTombstones()

建议: 考虑两种方案：

    方案 A：始终保留 Tombstone，仅在同步成功或用户明确要求时清理。
    方案 B：如果用户从未开启过同步，可以立即清理；但如果曾经开启过，应保留 Tombstone 以备后续同步。

3. performPull 中的 isSyncing 检查可能不够充分

文件: src/background/main.ts, 第 485 行

async function performPull(retries = 3) {
  if (isSyncing) return

问题: 虽然函数开头有 isSyncing 检查，但在 enqueueSync 内部，isSyncing 被设置为 true 后，其他并发的 performPull 调用会在 enqueueSync 之前返回，但已经在队列中。这可能导致不必要的队列堆积。

建议: 考虑在 enqueueSync 内部也检查 isSyncing，或者使用更细粒度的锁机制。