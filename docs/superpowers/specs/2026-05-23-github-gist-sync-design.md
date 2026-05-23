# 设计文档：GitHub Gist 自动化同步方案

## 1. 背景与目标
随着 Highlight-Mark-Flow 功能的完善，用户对多端数据同步（如办公室与家庭电脑）的需求日益增加。本方案旨在利用 GitHub Gist 作为轻量级后端，实现数据的透明、安全、自动化同步。

### 核心目标
- **多端一致性**：通过 GitHub Gist 媒介，确保不同设备上的标记和标签数据保持同步。
- **无感体验**：后台自动执行合并与上传，减少用户手动干预。
- **数据安全**：基于时间戳的冲突解决策略，最大限度防止数据丢失。

## 2. 核心架构

### 2.1 通信层
- **技术选型**：使用 GitHub REST API (v3)。
- **鉴权**：用户需提供 GitHub Personal Access Token (PAT)，权限范围仅需 `gist`。
- **存储载体**：单个 GitHub Gist，内含 `marks.json` 和 `tags.json`（或合并为一个文件）。

### 2.2 逻辑层 (Sync Engine)
- **拉取 (Pull)**：插件初始化或网络恢复时，从远程拉取数据并与本地合并。
- **推算 (Push)**：本地数据变更后，触发延迟（Debounce）上传逻辑。
- **合并策略**：
    - 以 `id` 为唯一标识。
    - 冲突时对比 `createdAt` 时间戳，保留最新版本。
    - 处理逻辑：`FinalData = LocalData ∪ RemoteData (with timestamp wins)`。

## 3. 详细设计

### 3.1 数据存储结构 (Gist 内部)
```json
{
  "description": "Highlight-Mark-Flow Sync Data",
  "files": {
    "markflow_sync.json": {
      "content": "{ \"marks\": {...}, \"tags\": {...}, \"lastSync\": 1684828800000 }"
    }
  }
}
```

### 3.2 流程说明
1. **初始化绑定**：
    - 用户输入 Token。
    - 插件搜索名为 `markflow_sync.json` 的 Gist。
    - 若不存在则新建，若存在则记录其 `gistId`。
2. **变更监听**：
    - 监听 `browser.storage.onChanged`。
    - 触发 `pushSync` 函数，设置 10 秒防抖，避免高频请求 GitHub API。
3. **静默同步**：
    - 后台 Service Worker 定时（或在唤醒时）执行 `pullSync`。

## 4. 存储与性能考虑
- **Local-first**：所有数据在本地均有副本，确保离线可用及访问性能。
- **unlimitedStorage (建议)**：虽然本方案不强制要求，但建议在 `manifest.json` 中添加 `unlimitedStorage` 权限，以支持用户存储海量高亮数据（突破默认 5MB 限制）。

## 5. 错误处理
- **Token 失效**：UI 提示用户重新配置。
- **网络异常**：指数退避重试（Exponential Backoff）。
- **配额限制**：监控 GitHub API Rate Limit，达到上限时暂停同步并通知用户。

## 6. 安全与隐私
- **最小权限原则**：PAT 仅需 `gist` 权限，不涉及用户仓库数据。
- **私有存储**：默认创建 `secret` 类型的 Gist，仅持有 Token 的客户端可访问。
