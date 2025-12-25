---

# 📝 知识归档：Summary for Issue #3

## 1. 元数据 (Metadata)

* **Task ID**: `#3`
* **日期**: 2025-12-25
* **类型**: `FIX` / `FEAT`
* **涉及文件**: `src/contentScripts/index.ts`
* **Breaking Changes**: `No`

---

## 2. 核心摘要 (Core Summary)

### 🚀 最终解决问题的关键点

- **SPA 页面适配 (Zombie Component Fix)**:

  - **问题**: 路由切换（软刷新）导致 `document.body` 重绘，销毁了挂载的 Tooltip 容器，但内存变量 `tooltipApp` 仍指向旧实例。
  - **方案**: 引入 `ensureTooltipMounted()`。在显示前强制检查 DOM 容器 ID，若缺失则重新初始化 Shadow DOM 并挂载 Vue 实例。

- **Shadow DOM 全面支持**:

  - **事件穿透**: 递归遍历 Shadow Root 绑定 `mousedown/mouseup`，解决冒泡拦截问题。
  - **选区序列化**: 为 `rangy` 操作显式注入 `root` 上下文，并利用 `shadowHostSelector` 实现跨 Shadow 边界的高亮恢复。

- **竞态条件隔离**:
  - **逻辑解耦**: 将 `tooltipDebounceTimer` 与 `restoreDebounceTimer` 物理分离，确保“用户手动高亮”与“系统自动恢复”两个异步过程互不干扰。

### 🧠 关键技术点 (Knowledge Points)

- **选区“烘焙” (Selection Baking)**: 决定在 `processSelection` 中通过 `cloneRange()` 锁定快照，对抗 Shadow DOM 中 Selection 对象的不稳定性。
- **Rangy Root 注入**: 明确在非主文档环境下，必须传入 `root` 参数，否则 XPath 计算将失效。
- **防御式挂载**: `ensureTooltipMounted` 模式解决了注入式脚本在动态 DOM 变动下的存活率问题。

---

## 3. 沉淀与反思 (Post-mortem)

### ⚠️ 避坑指南 (Lessons Learned)

- **The `normalize()` Trap**:
  - **现象**: “三击全选”后高亮无法应用。
  - **根因**: 清理预览时调用 `parent.normalize()` 合并文本节点，破坏了浏览器的 Live Range 锚点。
  - **教训**: **处理即时选区时，严禁对选区路径内的 DOM 进行破坏性操作（如合并或拆分节点）。**

### 💎 复用价值

- `ensureTooltipMounted`：通用的注入组件防销毁方案。
- `querySelectorAllDeep`：通用的 Shadow DOM 穿透查找工具函数。

---

## 4. 影响评估 (Impact)

- **改善模块**: `Content Script` 稳定性极大增强，尤其在 YouTube、GitHub 等复杂 Web Components 站点。
- **遗留技术债**: 暂时回退了针对“全选”崩溃的补丁。未来需引入 **“锚点保护机制” (Anchor Protection)** 重构 `clearPreviewHighlight`。

---

## 5. 验证状态 (Verification)

- ✅ SPA 路由切换后 Tooltip 自动重建
- ✅ Shadow DOM 内文本成功高亮并持久化
- ✅ 多定时器冲突解决，高亮响应无卡顿

---
