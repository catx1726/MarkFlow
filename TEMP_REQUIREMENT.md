# TODO

# BUG

  ```markdown 
  严重问题 (Blocking)
  
  B1: 删除操作可能导致数据丢失

  文件: src/background/main.ts (line ~123-155)

  问题: 当前删除标记的实现使用了软删除（设置 deletedAt），但在 remove-mark-by-url 和 remove-marks 消息处理器中，当 URL 下的所有标记都被软删除后，marksByUrl.value[url] 仍然存在（包含所有已删除的标记）。这会导致：

      内存占用持续增长，因为已删除的标记永远不会被清理
      在 get-marks-for-url 中虽然过滤了 deletedAt，但底层存储仍然保留着这些数据

  建议: 实现一个定期清理机制，或者在同步确认后物理删除已标记为删除的数据。例如，在 performPull 成功后，可以清理那些在所有设备上都已被删除的标记。

  // 在 performPull 成功后添加清理逻辑
  function cleanupDeletedMarks() {
    for (const [url, marks] of Object.entries(marksByUrl.value)) {
      const activeMarks = marks.filter(m => !m.deletedAt)
      if (activeMarks.length === 0) {
        delete marksByUrl.value[url]
      } else {
        marksByUrl.value[url] = activeMarks
      }
    }
  }

  B2: 同步配置变更未触发推送

  文件: src/background/main.ts (line ~395-405)

  问题: browser.storage.onChanged 监听器只检查了 marks-by-url-storage 和 webmarker-tags-metadata 的变更，但没有监听同步配置自身的变更。当用户在 Options 页面修改 syncConfig.enabled 或 syncConfig.gistId 时，不会触发推送。更严重的是，如果用户在其他设备上修改了同步配置（例如禁用了同步），当前设备无法感知。

  建议: 添加对同步配置变更的监听，并在配置变更时重新评估同步状态。

  browser.storage.onChanged.addListener((changes) => {
    if (changes['marks-by-url-storage'] || changes['webmarker-tags-metadata']) {
      performPush()
    }
    // 监听同步配置变更
    if (changes['webmarker-sync-config']) {
      const newConfig = changes['webmarker-sync-config'].newValue
      if (newConfig.enabled && newConfig.gistId) {
        performPull()
      }
    }
  })

  B3: 并发写操作可能导致数据竞争

  文件: src/background/main.ts (line ~395-410)

  问题: performPush 和 performPull 函数没有使用 enqueueWrite 进行同步。当推送和拉取同时发生时，可能会导致：

      推送时读取了正在被拉取修改的数据
      拉取后推送，覆盖了拉取的最新数据
      数据不一致

  建议: 将同步操作也纳入写队列管理，或者实现一个简单的互斥锁。

  let syncInProgress = false

  async function performPush() {
    if (syncInProgress) return
    syncInProgress = true
    try {
      // ... 现有逻辑
    } finally {
      syncInProgress = false
    }
  }

  async function performPull(retries = 3) {
    if (syncInProgress) return
    syncInProgress = true
    try {
      // ... 现有逻辑
    } finally {
      syncInProgress = false
    }
  }
  ```