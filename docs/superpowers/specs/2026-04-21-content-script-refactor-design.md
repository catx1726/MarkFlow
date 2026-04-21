# 2026-04-21 Content Script 架构重构设计 (Refactor Spec)

## 1. 背景 (Context)
当前的 `@src/contentScripts/index.ts` 承担了过多的职责，包含 UI 管理、用户交互监听、以及核心的标记恢复逻辑。文件长度超过 1100 行，且采用过程式函数模式，与已重构的 `logic/dom.ts` 和 `logic/search.ts` 的类封装模式不统一。

## 2. 目标 (Objectives)
- **架构解耦**：将职责拆分为独立的类，遵循单一职责原则。
- **模式统一**：采用类封装和依赖注入模式。
- **性能优化**：通过逻辑分片减少主线程阻塞。
- **可测试性**：支持对逻辑层进行独立单元测试。

## 3. 详细架构设计 (Detailed Architecture)

### 3.1 核心类划分

#### `MarkerApp` (总控调度)
- **位置**：`@src/contentScripts/index.ts`
- **职责**：
    - 初始化子系统（Restorer, Interaction, UI）。
    - 管理全局配置（Settings）的注入与响应。
    - 处理跨标签页/Background 的消息分发。
- **生命周期**：单例。

#### `RestorationEngine` (恢复引擎)
- **职责**：
    - 实现标记的四级恢复流 (Restoration Flow)。
    - 管理 `MutationObserver`，监听 DOM 变化触发增量恢复。
    - 维护恢复状态：`restoredMarkIds`, `failedRestoreCooldowns`。
- **依赖**：`DOMScanner`, `Highlighter`, `findCandidateElements`。

#### `InteractionController` (交互控制器)
- **职责**：
    - 管理所有原生事件（mousedown, mouseup, keydown）。
    - 选区处理逻辑：`processSelection`, `handleExistingMarkClick`。
    - 跨 Shadow DOM 的事件委托。
- **依赖**：`DOMSelector`, `UIPortal`。

#### `UIPortal` (UI 门户)
- **职责**：
    - 维护扩展专用的 Shadow DOM 容器。
    - 管理 Vue 组件实例（Tooltip, DisambiguationModal）的生命周期。
    - 提供声明式接口：`showTooltip()`, `showModal()`, `hideAll()`。

### 3.2 共享状态 (State Management)
采用 Vue `reactive` 创建扁平化的全局状态对象，供各子系统共享：
```typescript
interface AppState {
  currentSelection: {
    serialized: string | null;
    root: Node | undefined;
    text: string;
  };
  ambiguousMarks: Candidate[];
  isRestoring: boolean;
  settings: any;
}
```

## 4. 关键流程设计 (Key Flows)

### 4.1 标记恢复流 (Restoration Flow)
1. `RestorationEngine` 启动。
2. 从 Background 获取当前 URL 的 Marks。
3. 循环调用 `applyMarks()`：
    - L1: 尝试 Rangy 路径还原。
    - L2/L3: 失败则调用 `search.ts` 的搜索策略。
    - 产生歧义则推入 `appState.ambiguousMarks`。
4. `UIPortal` 监听 `appState.ambiguousMarks` 变化，自动弹出 Modal。

### 4.2 用户交互流 (Interaction Flow)
1. `InteractionController` 捕获 `mouseup`。
2. 调用 `processSelection()` 校验选区。
3. 更新 `appState.currentSelection`。
4. `UIPortal` 根据状态显示 Tooltip。

## 5. 实现阶段 (Implementation Phases)

1. **第一阶段**：定义接口与状态模型。
2. **第二阶段**：抽离 `UIPortal`（将现有的 Vue 挂载逻辑迁移至此类）。
3. **第三阶段**：抽离 `InteractionController`（迁移事件监听与选区处理）。
4. **第四阶段**：抽离 `RestorationEngine`（迁移恢复算法与 Observer）。
5. **第五阶段**：精简 `index.ts` 为引导程序（Bootstrapper）。

## 6. 验证准则 (Verification Criteria)
- 现有高亮恢复功能无回归。
- 歧义弹窗能够正确弹出并完成物理纠偏。
- 跨 Shadow DOM 的标记操作正常。
- 页面性能无明显下降（MutationObserver 无死循环）。
