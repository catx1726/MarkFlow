# Design Spec: Content Script 架构重构 — 类封装与职责分离

- **Date**: 2026-04-28
- **Status**: Draft
- **Related Issue**: #26
- **Topic**: 将 `src/contentScripts/index.ts` 从过程式代码重构为类架构，与 `src/logic/dom.ts` 和 `src/logic/search.ts` 的设计标准对齐

## 1. 背景与动机

`src/contentScripts/index.ts`（1073 行）存在以下结构性问题：

1. **状态管理散乱**：20+ 模块级 `let`/`const` 变量分散
2. **职责混杂**：UI 挂载、事件处理、高亮 CRUD、四级恢复、消息监听全部耦合
3. **代码重复严重**：Shadow Host Selector 构建重复 3 次、`update-mark-details` 消息重复 2 次、`stripHighlights + tempDiv + innerHTML` 片段提取重复 2 次
4. **魔法数字泛滥**：3000ms cooldown、95/80 相似度阈值、50ms debounce 等缺乏命名常量
5. **`applyMarks` 过度膨胀**：单个函数超 150 行，同时处理 L1-L4 全流程

## 2. 架构设计

### 2.1 类职责与放置

| 类 | 路径 | 职责 | 依赖 |
|---|---|---|---|
| `ShadowDOMManager` | `src/logic/shadowDom.ts` | Shadow DOM 容器创建、UI 挂载、选择器构建 | 无 |
| `HighlightStateManager` | `src/contentScripts/state.ts` | `restoredMarkIds` / cooldowns / ambiguousMarks 等状态管理 | 无 |
| `UIManager` | `src/contentScripts/ui.ts` | Tooltip / DisambiguationModal 展示、隐藏、协调 | `ShadowDOMManager`, `HighlightStateManager` |
| `ContentChangeMonitor` | `src/contentScripts/monitor.ts` | MutationObserver + SPA 导航监听 | `HighlightStateManager` |
| `HighlightRestorer` | `src/contentScripts/restorer.ts` | 四级恢复流程 (L1-L4) | 以上全部 + `search.ts` + `dom.ts` |

### 2.2 重构顺序（增量式）

```
Step 1: ShadowDOMManager  → 新文件 + 单元测试
Step 2: HighlightStateManager → 新文件 + 单元测试
Step 3: UIManager          → 新文件 + 单元测试
Step 4: ContentChangeMonitor → 新文件 + 单元测试
Step 5: HighlightRestorer  → 新文件 + 单元测试（最复杂）
Step 6: index.ts 入口精简  → 集成验证，确保现有测试通过
```

每一步完成后执行 `npm test` 验证回归。

## 3. 类接口设计

### 3.1 ShadowDOMManager (`src/logic/shadowDom.ts`)

```typescript
export class ShadowDOMManager {
  static createContainer(): HTMLDivElement
  static mountUI(container: HTMLDivElement, tooltipComponent, modalComponent): { tooltip, modal }
  static buildShadowHostSelector(element: Element): string | undefined
  static resolveShadowHost(selector: string): ShadowRoot | undefined
}
```

负责将 Shadow DOM 容器创建、UI 挂载、宿主链选择器构建统一封装。消除 Shadow Host Selector 重复 3 次的问题。

### 3.2 HighlightStateManager (`src/contentScripts/state.ts`)

```typescript
export class HighlightStateManager {
  restoredMarkIds: Set<string>
  failedRestoreCooldowns: Map<string, number>
  ambiguousMarksQueue: Ref<Candidate[]>
  isRestoring: boolean
  tooltipApp: TooltipInstance | null
  // ... etc

  constructor()
  isRestored(id: string): boolean
  markRestored(id: string): void
  isOnCooldown(id: string): boolean
  setCooldown(id: string, duration: number): void
  clearState(): void
}
```

将模块级变量的声明和 CRUD 封装为类方法。

### 3.3 UIManager (`src/contentScripts/ui.ts`)

```typescript
export class UIManager {
  constructor(private state: HighlightStateManager)
  ensureMounted(): void
  showTooltipForSelection(x: number, y: number, text: string): void
  showTooltipForExistingMark(markId: string, x: number, y: number): Promise<void>
  hideTooltip(): void
  clearPreview(): void
  showDisambiguationModal(): void
  hideDisambiguationModal(): void
}
```

负责 UI 组件（Tooltip / DisambiguationModal）的挂载、显示、隐藏事件。

### 3.4 ContentChangeMonitor (`src/contentScripts/monitor.ts`)

```typescript
export class ContentChangeMonitor {
  constructor(private state: HighlightStateManager)
  setupGlobalObserver(): void
  setupSPAListener(): void
  destroy(): void
}
```

将 MutationObserver 和 SPA 导航监听封装为可管理单元。

### 3.5 HighlightRestorer (`src/contentScripts/restorer.ts`)

```typescript
export class HighlightRestorer {
  constructor(
    private state: HighlightStateManager,
    private ui: UIManager
  )
  async restoreHighlights(): Promise<void>
  async applyMarks(marks: Mark[]): Promise<void>
  async refreshHighlights(): Promise<void>
  debouncedRestore(): void
  async scrollToMark(markId: string): Promise<void>
}
```

将 `applyMarks` 的 L1-L4 流程拆分为独立方法，消除模板代码重复。

## 4. 消除重复方案

| 重复模式 | 出现位置 | 消除方案 |
|---|---|---|
| Shadow Host Selector 构建 | `createHighlight`, `handleConfirmResolution`, `applyMarks` | 抽取到 `ShadowDOMManager.buildShadowHostSelector` |
| `update-mark-details` 发送 | `handleConfirmResolution`, `applyMarks` L3 分支 | 抽取到 `HighlightRestorer.updateMarkDetails` |
| `stripHighlights + tempDiv + innerHTML` | `createHighlight`, `handleConfirmResolution`, `applyMarks` | 抽取到 `HighlightRestorer.extractHtml` |

## 5. 常量提取

| 魔法数字 | 常量名 | 值 |
|---|---|---|
| 3000 | `COOLDOWN_DURATION` | 3000ms |
| 95 | `L1_SIMILARITY_THRESHOLD` | 95 |
| 80 | `CONTEXT_SIMILARITY_THRESHOLD` | 80 |
| 75 | `L3_SIMILARITY_THRESHOLD` | 75 |
| 50 | `TOOLTIP_DEBOUNCE` | 50ms |
| 300 | `RESTORE_DEBOUNCE` | 300ms |

## 6. 设计原则

- **SRP**: 每个类仅负责单一职责
- **DRY**: 消除所有模板代码重复
- **LoD**: 类间通过接口通信，不跨类操作 DOM
- **逻辑平移策略**: 保持算法和阈值不变，仅移动代码结构

## 7. 测试策略

| 步骤 | 测试类型 | 覆盖内容 |
|---|---|---|
| 1-4 新建类 | 单元测试 | 各类的独立行为 |
| 5 HighlightRestorer | 单元测试 | L1-L4 恢复流程 |
| 6 入口整合 | 回归测试 | `npm test` 全部通过 |

## 8. 风险与缓解

- **风险 1**：四级恢复流程重构可能引入回归 → 逻辑平移策略，保持算法与阈值不变
- **风险 2**：`HighlightStateManager` 需兼容 Vue 响应式 → 保留 `reactive`/`ref` 用法
- **风险 3**：SPA 监听 Observer 重复创建 → `ContentChangeMonitor` 内部单例模式
