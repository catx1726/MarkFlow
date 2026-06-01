# 设计规范：存储竞争条件修复与数据防丢失

- **日期**: 2026-05-27
- **关联 Issue**: GitHub #44 (Critical Data cleared after extension update)
- **状态**: 待评审

## 1. 问题描述
该扩展存在严重的竞争条件：后台脚本（Background Script）的消息处理器在存储从磁盘完全加载之前就已开始执行。结合 `useWebExtensionStorage` 默认会在存储“为空”时回写初始值的行为，这导致在脚本重启或更新瞬间，用户数据被空的初始对象 `{}` 覆盖。

## 2. 变更方案

### 2.1 存储层 (`src/composables/useWebExtensionStorage.ts`)
- **操作**: 将 `writeDefaults` 选项的默认值从 `true` 改为 `false`。
- **理由**: 防止在初始化读取阶段，因 API 延迟或判断逻辑误将磁盘数据视为空而触发自动回写。数据应仅在业务逻辑明确修改内存值后才进行持久化。

### 2.2 后台脚本 (`src/background/main.ts`)
- **操作**: 为所有涉及状态变更的消息处理器添加强制初始化守卫。
- **实现方式**:
  ```typescript
  const ensureReady = () => Promise.all([dataReady, tagsReady, syncReady, statusReady]);

  onMessage('add-mark', async (payload) => {
    await ensureReady();
    // ... 业务逻辑
  });
  ```
- **理由**: 确保所有来自 Content Script 或 Popup 的消息，必须等待 Background 状态完全恢复后才能被处理，消除并发写入风险。

### 2.3 清单文件 (`src/manifest.ts`)
- **操作**: 移除 `browser_specific_settings` 中非标准的 `data_collection_permissions` 字段。
- **理由**: 该字段不符合标准 WebExtension 规范，可能导致 Firefox (AMO) 审核警告或更新时的异常权限提示。

## 3. 验证计划

### 3.1 单元测试
- 模拟 `storage.local.get` 的延迟，验证消息处理器是否正确等待。
- 验证 `useWebExtensionStorage` 在初次读取时（即使存储为空）不会调用 `storage.local.set`。

### 3.2 手动验证
- 模拟扩展更新/重启流程，确认历史高亮数据完好无损。
- 确认 Firefox 清单文件校验通过。
