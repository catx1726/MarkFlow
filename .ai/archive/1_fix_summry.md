---
task_id: '1'
date: '2025-12-22'
type: 'FIX'
affected_files:
  - 'src/contentScripts/index.ts'
  - 'src/contentScripts/views/Tooltip.vue'
breaking_changes: 'No'
---

# Issue #1 总结：Shadow DOM 选区异常与 Tooltip 闪烁修复

## 1. 核心摘要

### 最终解决问题的关键点

本次修复解决了插件在 **Shadow DOM (Web Components)** 环境下的三大核心痛点：事件阻断、样式隔离（z-index）以及选区库（Rangy）的上下文缺失。

- **事件穿透**：通过 `NodeIterator` 递归遍历所有 `shadowRoot` 并手动注入 `mousedown/mouseup` 捕获阶段监听器，解决了选区事件无法冒泡至 window 的底层问题。
- **消除闪烁**：移除了冗余的全局事件绑定，并引入了 50ms 的防抖逻辑，确保浏览器在 Tooltip 显示前完成选区计算。
- **上下文感知序列化**：重构了高亮存储逻辑，通过 `getRootNode()` 动态识别 `ShadowRoot` 并在调用 `rangy` 时显式传入该根节点，解决了选区无法跨越物理边界的报错。

## 2. 关键技术点 (Knowledge Points)

### 技术决策

1. **NodeIterator 遍历策略**：相比 `querySelectorAll('*')`，`NodeIterator` 配合自定义 `NodeFilter` 只访问具有 `shadowRoot` 的元素，极大地降低了在大规模 DOM 树下的性能损耗。
2. **动态 z-index 计算**：放弃了初始化时的一次性计算，改为在 Tooltip 每次 `show()` 时递归扫描包含 Shadow DOM 在内的所有元素层级，确保弹窗始终处于顶层。
3. **宿主标记法 (Shadow Host Selector)**：为 Shadow Host 动态分配 `data-web-marker-host-id`，解决了持久化数据在恢复时找不到物理挂载点的问题。

### 防御式编程实现

- **API 容错**：在 `getComputedStyle` 和 DOM 递归逻辑中包裹 `try...catch`，防止因遇到已分离的 iframe 或跨域元素导致插件崩溃。
- **状态闭环**：在 `finally` 块中强制重置 `currentSerializationRoot` 和 `currentSelection`，确保单次操作异常不会污染后续工作流。

## 3. 沉淀与反思

### 学习心得 (Lessons Learned)

- **避坑指南**：处理 Shadow DOM 时，`window.getSelection()` 可能失效，必须结合 `range.commonAncestorContainer.getRootNode()` 来获取真实的选区上下文。
- **复用价值**：`attachListenersToShadowRoots` 函数已抽象为通用模块，后续可直接复用于其他需要穿透 Web Components 的子任务。

### 项目稳定性影响

- **改善模块**：显著提升了 `contentScripts` 在现代复杂网页（如 OA 系统、组件库文档）中的鲁棒性。
- **遗留技术债**：
  1. 目前采用全量增量扫描，未来应优化为仅扫描 `MutationObserver` 提供的 `addedNodes`。
  2. 尚未实现 `removeEventListener` 的清理逻辑，存在极低概率的内存泄露风险（将在 Issue #2 优化）。

---

_此文档由 AI 与开发者协作生成，已通过 SOP 合规性检查。_
