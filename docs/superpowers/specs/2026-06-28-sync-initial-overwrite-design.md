---
spec_id: SPEC-2026-06-28-001
title: 修复初始同步时 Gist 数据被本地数据覆盖的问题
date: 2026-06-28
status: draft
---

# 修复初始同步时 Gist 数据被本地数据覆盖的问题

## 1. 背景与目标

用户在「测试同步」时，发现连接已有 Gist 后，远程 Gist 中的数据被本地（可能为空或不完整）的数据覆盖。本规格要求修复该问题，确保**首次连接现有 Gist 时必须先完成拉取合并，再启用自动推送**。

## 2. 根因分析

当前 `src/options/Options.vue` 的 `connectSync()` 流程：

1. 找到已有 Gist 后，立即设置 `syncConfig.gistId` 与 `syncConfig.enabled = true`。
2. `enabled = true` 会触发 `storage.onChanged`，进而调用 `performPull()`。
3. 同时 `connectSync()` 主动调用 `sendMessage('trigger-sync')`，再次触发 `performPull()`。
4. `performPull()` 合并远程数据到本地后，修改 `marksByUrl` / `tagsMetadata`，触发 `storage.onChanged`，从而调用 `performPush()`。
5. `performPush()` 仅依赖 `isSyncing` 标志与 `enabled` 状态，没有检查「是否已成功完成过初始拉取」。

风险：自动推送在初始拉取完成前即被启用，若拉取失败、合并异常或时序问题导致本地数据未正确合并，就可能把本地数据推送回 Gist，覆盖远程数据。

## 3. 需求范围

### 3.1 连接现有 Gist 时：先拉取合并，再启用同步

- `connectSync()` 在找到现有 Gist 后，应**先完成一次强制拉取并合并**，成功后再设置 `enabled = true`。
- 拉取失败时保持 `enabled = false`，向用户提示错误，不覆盖远程数据。
- 合并逻辑继续使用现有的 `mergeMarks` / `mergeTags`。

### 3.2 推送增加安全门

- `performPush()` 增加检查：若 `syncStatus.lastSyncStatus === 'none'`，则跳过推送。
- 该门确保即使因其他路径触发了 Push，也不会在从未成功拉取的情况下把本地数据推送到远程。

### 3.3 后台支持强制拉取

- `trigger-sync` 消息或新增消息支持在 `enabled = false` 时也能执行拉取，供 `connectSync()` 在启用前调用。

## 4. 最小侵入边界

1. 不改动合并算法 `mergeMarks` / `mergeTags`。
2. 不删除现有推送/拉取逻辑，仅增加前置条件。
3. 不改变正常同步流程，仅修复初始连接阶段的安全缺口。

## 5. 测试策略

1. **单元测试**：在 `src/tests/sync.spec.ts` 中新增 `canPush` 与 `applyRemoteData` 的测试。
2. **流程测试**：验证 `connectSync` 等价的拉取-合并-启用顺序。
3. **回归测试**：运行现有 `sync.spec.ts` 与相关测试，确保无新增失败。

## 6. 验收标准

- [ ] 连接到已有 Gist 时，本地空数据不会覆盖远程数据。
- [ ] 拉取失败时，同步保持禁用状态并提示用户。
- [ ] 从未成功拉取时，`performPush` 不会调用 `updateGist`。
- [ ] 现有测试不新增失败。
