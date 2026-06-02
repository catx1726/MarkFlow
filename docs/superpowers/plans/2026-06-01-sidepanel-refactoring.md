# Sidepanel 逻辑与 UI 全模块化重构实施计划

**目标**: 将 `Sidepanel.vue` 拆分为 5 个逻辑 Composable 和 5 个 UI 子组件，彻底解耦业务逻辑与视图展示。

**架构**: 采用 Vue 3 组合式 API (Composables) 封装领域逻辑，使用 Props 和 Emit 实现组件间通信，Sidepanel.vue 作为顶层容器进行状态组合。

---

### Task 1-5: 逻辑抽取 (Composables)
- 提取 `useSidepanelData.ts`
- 提取 `useUIState.ts`
- 提取 `useStorageMonitor.ts`
- 提取 `useTagActions.ts`
- 提取 `useMarkActions.ts`

### Task 6-8: 组件化拆分 (UI Components)
- 创建 `MarkItem.vue`
- 创建 `PageSection.vue`
- 创建 `TagFolder.vue`
- 创建 `SidepanelHeader.vue`
- 创建 `StorageManager.vue`

### Task 9: 整合 Sidepanel.vue
- 清理旧代码，引入 Composable 和新组件。
- 验证全量功能。

### Task 10: 完善测试
- 补充 `buildTagTree` 边界测试。
- 增加所有 Composables 的单元测试。
