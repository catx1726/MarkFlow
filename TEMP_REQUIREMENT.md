# TODO

# BUG

1. 严重问题 (Blocking)

B1: TEMP_REQUIREMENT.md 中已识别的 BUG 未被修复

文件: TEMP_REQUIREMENT.md (line ~1-85) 问题: 该文件详细记录了三个严重问题（B1-B3），包括：

    B1: 删除操作可能导致数据丢失
    B2: 同步配置变更未触发推送
    B3: 并发写操作可能导致数据竞争

虽然代码中部分解决了这些问题（如添加了 syncInProgress 互斥锁、监听同步配置变更），但 TEMP_REQUIREMENT.md 本身是一个临时需求文档，不应该出现在最终提交中。更重要的是，文档中提到的 BUG 需要确认是否已完全解决。

建议:

    删除 TEMP_REQUIREMENT.md 文件（或将其内容移至 Issue 跟踪）
    确认 B1-B3 已完全修复，并在代码中添加相应的单元测试

B2: performPull 中的 syncInProgress 检查可能导致死锁

文件: src/background/main.ts (line ~400-410) 问题: performPull 和 performPush 都使用 syncInProgress 互斥锁，但 performPull 内部调用了 enqueueWrite，而 enqueueWrite 可能触发 performPush（通过 browser.storage.onChanged）。这可能导致：

    performPull 获取 syncInProgress 锁
    performPull 调用 enqueueWrite 修改存储
    存储变化触发 performPush
    performPush 因 syncInProgress 为 true 而跳过

虽然不会死锁，但可能导致推送被意外跳过，造成数据不一致。

建议: 考虑使用更细粒度的锁，或者将推送和拉取操作序列化到一个队列中。

// 建议方案：使用队列而非简单的互斥锁 const syncQueue = new Map<'push' | 'pull', Promise<void>>()

async function enqueueSync(type: 'push' | 'pull', fn: () => Promise<void>) { const existing = syncQueue.get(type) const promise = (existing || Promise.resolve()).then(fn).finally(() => { if (syncQueue.get(type) === promise) { syncQueue.delete(type) } }) syncQueue.set(type, promise) return promise }

B3: mergeMarks 函数未处理 deletedAt 的边界情况

文件: src/logic/sync.ts (line ~30-50) 问题: 当本地和远程的标记都被删除时，合并逻辑会保留 deletedAt 较大的版本。但如果在所有设备上都已删除的标记永远不会被物理清理，会导致数据无限增长。

建议: 在 performPull 成功后添加清理逻辑（当前代码已有部分实现），但需要确保清理逻辑在每次同步后都执行，而不仅仅是初始拉取时。

// 在 performPull 和 performPush 成功后都执行清理 async function cleanupTombstones() { await enqueueWrite(async () => { const updatedMarksByUrl = { ...marksByUrl.value } let hasCleanup = false for (const [url, marks] of Object.entries(updatedMarksByUrl)) { const activeMarks = marks.filter(m => !m.deletedAt) if (activeMarks.length === 0) { delete updatedMarksByUrl[url] hasCleanup = true } else if (activeMarks.length !== marks.length) { updatedMarksByUrl[url] = activeMarks hasCleanup = true } } if (hasCleanup) marksByUrl.value = updatedMarksByUrl }) }

B4: syncConfig 的 token 存储在 localStorage 中存在安全风险

文件: src/logic/storage.ts (line ~25-30) 问题: GitHub Personal Access Token 被存储在浏览器的 localStorage 中。虽然这是浏览器扩展的常见做法，但：

    任何具有 storage 权限的扩展都可以读取
    如果用户设备被入侵，Token 可能泄露
    没有提供 Token 的加密存储

建议:

    考虑使用 chrome.storage.sync 或 chrome.storage.local 的加密存储
    在 UI 中添加安全提示，告知用户 Token 的存储方式
    考虑实现 Token 的混淆或加密存储
