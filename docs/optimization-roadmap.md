# WebMarker 优化路线图 (Optimization Roadmap)

本文档记录了 WebMarker 扩展各模块的优化目标与进度，作为工程演进的长期指导。

## 1. 核心逻辑层 (Core Logic)

| 模块 | 优化目标 | 状态 | 备注 |
| :--- | :--- | :--- | :--- |
| `dom.ts` | 实现 DOM 操作的类封装与原子化，支持多层级 Shadow DOM 穿透。 | [x] 已完成 | 采用 `DOMScanner`, `DOMSelector`, `Highlighter` 等类。 |
| `search.ts` | 实现搜索策略模式 (Strategy Pattern)，解耦多级匹配算法。 | [x] 已完成 | 采用 `ExactMatch`, `RegexMatch`, `ConsensusMatch` 策略。 |
| `storage.ts` | 优化持久化性能，引入版本迁移 (Migrations)，支持大规模数据导出。 | [ ] 待开始 | |
| `settings.ts` | 增强配置校验，支持多端配置同步与导出。 | [ ] 待开始 | |

## 2. 内容脚本层 (Content Scripts)

| 模块 | 优化目标 | 状态 | 备注 |
| :--- | :--- | :--- | :--- |
| `index.ts` | **架构解耦**。拆分为 `MarkerApp`, `InteractionController`, `RestorationEngine` 和 `UIPortal`。 | [ ] 进行中 | 当前重点优化对象。 |
| `views/` | 组件化抽离，优化 Vue 组件响应式性能，减少不必要的重绘。 | [ ] 待开始 | |

## 3. 后台脚本层 (Background Scripts)

| 模块 | 优化目标 | 状态 | 备注 |
| :--- | :--- | :--- | :--- |
| `main.ts` | 精益化消息总线，处理多标签页同步冲突，增强错误隔离。 | [ ] 待开始 | |

## 4. 基础设施与工程质量 (Infrastructure)

| 模块 | 优化目标 | 状态 | 备注 |
| :--- | :--- | :--- | :--- |
| `Testing` | 建立原子类单元测试，补充关键场景的 E2E 覆盖。 | [ ] 待开始 | |
| `Build` | 优化 Vite 构建配置，减少内容脚本体积，提高注入效率。 | [ ] 待开始 | |
