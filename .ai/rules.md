# 📜 MarkFlow 开发守则 (rules.md)

## 1. 技术栈与环境 (Tech Stack)

- **核心框架**: Vue 3 (SFC), TypeScript, Vite.
- **包管理**: 强制使用 `pnpm`.
- **样式方案**: UnoCSS + Tailwind CSS Typography.
- **库约定**:
- 跨浏览器兼容: 使用 `webextension-polyfill`.
- 组件通信: 使用 `webext-bridge`.
- 选区处理: 使用 `rangy` 及其插件（classapplier, serializer）.

---

## 2. DOM 操作核心准则 (The "Clean-before-Read" Principle)

> **这是本项目最核心的稳定保障准则。**

- **原子性执行**: 任何涉及 `normalize()` 或节点增删的 DOM 操作都会使 Range 对象失效.
- **事务流**: 必须遵循 `[清理预览] -> [获取/反序列化 Range] -> [业务逻辑] -> [重新渲染]` 的时序.
- **严禁污染**: 在保存选区或计算偏移量前，必须调用 `clearPreviewHighlight()` 将 DOM 回归至原始基准状态.

---

## 3. Shadow DOM 适配规范 (Web Components Rules)

- **穿透查询**: 禁止直接使用 `document.querySelector`，必须使用工具函数 `querySelectorDeep` 或 `querySelectorAllDeep`.
- **选区获取**: 在 Shadow DOM 内部，原生 `window.getSelection()` 可能失效，应优先尝试 `shadowRoot.elementFromPoint(x, y)` 结合 `composedPath` 手动重建 Range.
- **上下文感知**: 插入锚点或操作节点时，必须通过 `node.getRootNode()` 获取当前所在的 `Document` 或 `ShadowRoot`，严禁跨越物理边界插入节点.

---

## 4. SPA 与 动态页面适配

- **容器持久性**: SPA 路由切换可能销毁 `body` 上的挂载点。在 UI 交互前必须调用 `ensureTooltipMounted()` 检查并重新挂载 Vue 实例.
- **定时器隔离**: UI 交互防抖（`tooltipDebounceTimer`）与后台 DOM 观察（`restoreDebounceTimer`）的定时器必须物理隔离，防止交互逻辑被系统恢复逻辑意外中断.

---
