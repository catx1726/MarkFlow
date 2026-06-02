# Sidepanel 逻辑与 UI 全模块化重构设计 (Spec)

- **日期**: 2026-06-01
- **状态**: 已完成
- **目标**: 将 `Sidepanel.vue` 拆分为逻辑 Composable 和 UI 子组件，提升可维护性和可读性。

## 1. 背景与动机
目前 `Sidepanel.vue` 脚本量约 800 行，模板嵌套极深，逻辑（标签、标记、存储、UI状态）高度耦合，导致：
- 认知负担重，难以快速定位代码。
- 难以进行单元测试。
- UI 变动容易引起副作用。

## 2. 目录结构
重构后的 Sidepanel 相关目录如下：
```text
src/sidepanel/
├── Sidepanel.vue (容器组件)
├── components/ (子组件)
│   ├── SidepanelHeader.vue
│   ├── TagFolder.vue
│   ├── PageSection.vue
│   ├── MarkItem.vue
│   └── StorageManager.vue
└── composables/ (局部逻辑)
    ├── useSidepanelData.ts
    ├── useUIState.ts
    ├── useTagActions.ts
    ├── useMarkActions.ts
    └── useStorageMonitor.ts
```

## 3. 逻辑拆分 (Composables)

### 3.1 useSidepanelData.ts
- **输入**: `marksByUrl`, `tagsMetadata` (来自 global storage)。
- **输出**: `structuredMarks` (计算后的 `TagTree`)。
- **逻辑**: 封装 `watch` + `debounce` 逻辑，确保数据高效更新。

### 3.2 useUIState.ts
- **职责**: 管理折叠、菜单打开、弹窗显示等 UI 瞬时状态。
- **状态**: `collapsedUrls`, `expandedTexts`, `activeMenuId`, `tagPickerVisible` 等。
- **操作**: `toggleUrlCollapse`, `closeMenus`。

### 3.3 useTagActions.ts
- **职责**: 封装所有标签相关的写操作（与 Background 通信）。
- **操作**: `createTag`, `renameTag`, `deleteTag`, `toggleTagForMark`。

### 3.4 useMarkActions.ts
- **职责**: 封装标记相关的交互逻辑。
- **操作**: `gotoMark`, `editMark`, `saveNote`, `removeMark`, `copyMarkText`, `exportToMarkdown`。

### 3.5 useStorageMonitor.ts
- **职责**: 监控存储空间并执行清理任务。
- **状态**: `storageUsage`, `storageQuota`, `storageUsagePercent`。
- **操作**: `refreshUsage`, `cleanupOldMarks`, `cleanupUselessMarks`。

## 4. 组件拆分 (Components)

### 4.1 Sidepanel.vue (Root)
- 仅负责整体布局、引入 Composable 并分发 Props/Events。

### 4.2 SidepanelHeader.vue
- 顶部标题。
- “打开设置”按钮。
- 新建标签输入框（使用 `useTagActions`）。

### 4.3 TagFolder.vue
- 渲染 `structuredMarks` 中的每一个一级分类（标签/收集箱）。
- 包含文件夹操作菜单。

### 4.4 PageSection.vue
- 渲染特定标签下的页面列表及其分组。

### 4.5 MarkItem.vue
- 渲染单个高亮片段。
- 集成颜色显示、笔记编辑界面。
- 包含单个标记的操作菜单。

### 4.6 StorageManager.vue
- 底部固定栏。
- 存储进度条及清理按钮（使用 `useStorageMonitor`）。
