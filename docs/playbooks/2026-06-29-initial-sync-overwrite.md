# 初始同步覆盖远程数据问题

## 现象 (Symptom)

在设备 B（Chrome 扩展）上点击“连接并开启同步”，输入已有数据的 GitHub Gist Token 后：

1. 扩展没有拉取远程 Gist 中的数据。
2. 本地空白状态没有与远程合并。
3. 后续本地新增标记后，可能把远程 Gist 中的旧数据覆盖掉。
4. 过程中出现多种报错：
   - `withTimeout is not defined`
   - `performPull called { ..., hasGistId: false, ... }`
   - `trigger-sync` 消息无响应或超时

## 根因 (Root Cause)

本次问题由三个独立但叠加的原因构成：

### 1. GitHub `/gists` 列表接口不返回文件内容

`GET /gists` 返回的 `files` 对象中每个文件只有 `filename`、`raw_url`、`size` 等元数据，**没有 `content`**。原始代码直接在这个列表结果中读取 `content`，导致始终拿不到远程数据。

### 2. MV3 Service Worker 消息可靠性问题

Options 页面通过 `webext-bridge` 的 `sendMessage('trigger-sync', ...)` 向 background service worker 发送拉取指令。在 MV3 环境下：

- service worker 可能处于 idle 状态，消息无法唤醒它。
- `webext-bridge` 的响应通道有时不返回，导致 `await` 挂起。
- 即使消息送达，background 的 `syncConfig`（通过 VueUse Storage 同步）在跨 context 之间不是即时同步的，导致 `gistId` 在 background 端仍为旧值。

### 3. 时序与并发问题

- `connectSync` 之前先设置 `enabled = true` 再触发拉取，可能让 storage 监听器先触发 `performPush`。
- `performPull` 中 `toRaw(marksByUrl.value)` 的快照在 `enqueueWrite` 外部生成，如果排队期间有其他写操作，会被覆盖。

## 调试路径 (Debugging Trail)

1. **先怀疑是拉取逻辑没执行**：在 background 加日志，发现 `trigger-sync` 根本没收到，或者收到了但 `gistId` 是空的。
2. **确认 storage 跨 context 同步延迟**：options 里已经 `syncConfig.value.gistId = existingGist.id`，但 background 读取时仍为 `false`。
3. **验证 GitHub API 行为**：用浏览器 Network 面板确认 `/gists` 只返回元数据，必须再调 `GET /gists/{id}` 才能拿到 `content`。
4. **验证消息通道问题**：加 `console.log` 发现 `webext-bridge` 有时不返回；改用原生 `browser.runtime.sendMessage` 作为 fallback 后更稳定。
5. **修复后仍发现 `toRaw` 快照竞态**：AI CR 指出快照在队列外生成，进一步内移到 `enqueueWrite` 内部。

## 修复方案 (Fix)

### 读取 Gist 内容

- 新增 `getGistById(token, gistId)`，在 `performPull` 中用它替代直接从列表读取。
- `getGists()` 增加分页支持，避免 Gist 数量超过默认 30 个时找不到目标。

### 消息通道加固

- `Options.vue` 中抽离 `triggerPull({ force, token, gistId })`：
  - 先尝试 `webext-bridge`。
  - 超时后 fallback 到 `browser.runtime.sendMessage({ type: 'trigger-sync-pull', force, token, gistId })`。
- `background/main.ts` 同时监听：
  - `onMessage('trigger-sync', ...)`（webext-bridge 路径）
  - `browser.runtime.onMessage.addListener(...)`（native fallback 路径）
- `triggerPull` 发送前调用 `browser.runtime.getPlatformInfo()` 尝试唤醒 service worker。

### 避免跨 context storage 同步延迟

- `triggerPull` 把 `token` 和 `gistId` 显式传给 background。
- `performPull` 优先使用消息参数，fallback 到 `syncConfig.value`。

### 时序与并发

- `connectSync` 改为先 `triggerPull({ force: true })`，成功后再 `syncConfig.value.enabled = true`。
- `performPull` 返回 `Promise<boolean>`，`performPush` 根据返回值判断是否继续，不再读取全局 `syncStatus`。
- `performPull` 中 `toRaw(marksByUrl.value)` / `toRaw(tagsMetadata.value)` 移到 `enqueueWrite` 内部。

### 健壮性

- `mergeWithRemoteFile` 中 `JSON.parse` 增加 `try-catch`，解析失败返回本地数据。
- `withTimeout` 使用 `settled` 标志位避免微妙时序问题。

## 经验教训 (Lessons)

1. **不要假设跨 context 的 storage 响应式同步是即时的**。在 MV3 中，options / background / content script 之间的 storage 同步有延迟，关键参数应随消息显式传递。
2. **API 文档要仔细看字段**。GitHub `/gists` 和 `/gists/{id}` 返回的 `files` 对象结构不同，前者不含 `content`。
3. **MV3 下 service worker 消息要有多重保障**。`webext-bridge` 方便，但在某些场景下会丢消息或无响应，应保留原生 `runtime.sendMessage` fallback。
4. **异步队列外的快照是隐患**。任何 `toRaw()` + 异步写入的组合，都要考虑快照期间数据是否可能被其他写操作修改。
5. **加日志时把关键状态一起打印出来**。比如 `{ hasToken, hasGistId, enabled, isSyncing }` 这种结构化日志，能快速定位“参数没传到”这类问题。

## 关联代码

- `src/logic/sync.ts`: `getGists()`, `getGistById()`, `mergeWithRemoteFile()`
- `src/background/main.ts`: `onMessage('trigger-sync')`, `performPull()`, `performPush()`
- `src/options/Options.vue`: `connectSync()`, `triggerPull()`, `withTimeout()`
- `src/tests/sync.spec.ts`: `mergeWithRemoteFile` 测试用例

## 关联 Issue/PR

- Issue #50
- PR #51

---
*YOU-DRIVE-SOP - 驱动规约，掌握智力。*
