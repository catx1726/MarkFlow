# MarkFlow 同步机制深度解析

本文档旨在为开发者提供 MarkFlow 跨设备同步方案的技术细节，介绍我们如何利用 GitHub Gist 构建一个高性能、Local-first 且具备冲突解决能力的分布式系统。

## 1. 设计哲学：Local-first

我们坚持“本地优先”原则：
- **离线可用**：所有数据首先存储在浏览器的 `storage.local` 中，无需联网即可操作。
- **极致速度**：高亮的渲染和读取不经过网络，仅操作本地索引。
- **云端为辅**：GitHub Gist 仅作为数据交换的“记事本”和备份，不参与实时逻辑。

## 2. 核心架构

### 2.1 存储载体：GitHub Gist
选择 Gist 而非 Repository 的原因：
- **API 极简**：单一文件的读写仅需一个 PATCH 请求。
- **隐私隔离**：支持 Secret Gist，不出现在用户的公共仓库列表中。
- **免维护**：利用 GitHub 现成的版本管理和鉴权体系。

### 2.2 数据组织：Tombstone (墓碑机制)
在分布式系统中，物理删除是危险的，因为离线设备无法得知某个记录是被删除了还是从未存在过。
- **`deletedAt` 字段**：当用户删除标记时，我们不立即物理删除，而是打上 `deletedAt` 时间戳。
- **同步合并**：合并时，对比本地与远程的 `createdAt` 和 `deletedAt`，保留时间戳最新（最大）的版本。
- **物理清理 (Purge)**：在同步成功（确认云端已感知删除）或拉取合并后，本地会自动扫描并移除所有带有 `deletedAt` 的记录，保持存储精简。

## 3. 同步流程 (Sync Pipeline)

### 3.1 串行同步队列
为了防止 Push 和 Pull 同时运行导致数据覆盖，我们实现了一个基于 Promise 链的**单向串行队列**：
```typescript
let syncQueue = Promise.resolve();
async function enqueueSync(task) {
  syncQueue = syncQueue.then(task);
}
```
所有同步操作必须排队，确保状态转换是原子性的。

### 3.2 自动同步触发器
- **防抖推送 (Debounced Push)**：监听本地存储变化，设置 10 秒防抖窗口。用户连续标记时不会频繁请求 API。
- **指数退避重试 (Exponential Backoff)**：启动拉取失败时，以 1s, 2s, 4s 的间隔重试，提高弱网环境下的成功率。

## 4. 冲突解决策略

我们采用 **LWW (Last Write Wins)** 策略。
每个 Mark 拥有唯一 ID。合并逻辑如下：
1. 遍历远程数据。
2. 若本地无此 ID -> 新增。
3. 若两端均有此 ID -> 取 `Math.max(createdAt, deletedAt)` 较大者作为最终态。
4. 物理清理所有标记为已删除且已合并的记录。

## 5. 安全考量

- **最小权限**：引导用户生成仅勾选 `gist` 权限的 Token。
- **加密存储**：Token 存储在扩展私有的 `storage.local` 中。
- **过期处理**：系统会自动捕获 GitHub 的 401 错误，并在 UI 提示“身份验证失败”，同时自动暂停同步以保护账户安全。

---
*为开发者而生，让知识流动。*
