## ADDED Requirements

### Requirement: Skeleton-Muscle 二元模型定义
系统 SHALL 在 `ARCHITECTURE.md` 中显式定义治理 (OpenSpec) 与执行 (Superpowers) 的二元协作模型。其中 OpenSpec 作为 Skeleton (骨架) 负责管理变更的状态、决策与生命周期；Superpowers 作为 Muscle (肌肉) 负责提供 TDD、计划编写、系统调试等原子执行技能。

#### Scenario: 显性模型查阅
- **WHEN** AI 引擎或开发者阅读 `ARCHITECTURE.md`
- **THEN** 系统展示清晰的层次化定义，明确不同工具链在 SOP 生命周期中的职责边界

### Requirement: 核心资产生命周期微观流程图
系统 SHALL 提供 `meta-distiller` (提纯)、`OpenSpec` (提案/归档) 以及 `Skill Activation` (技能激活) 的详细微观流程图 (Mermaid 格式)。

#### Scenario: 动作路径对齐
- **WHEN** AI 引擎执行 `/opsx:propose` 或 `meta-distiller`
- **THEN** AI 能够引用 `ARCHITECTURE.md` 中的微观图表来对齐其实际执行步骤

### Requirement: 统一架构真值源 (SSOT)
系统 SHALL 确保所有关于物理架构、组件角色和核心协议的定义仅存在于 `ARCHITECTURE.md` 中。`GEMINI.md` 和 `SOP_CORE_MANUAL.md` 中的重复内容 MUST 被移除并替换为指向真值源的链接。

#### Scenario: 消除定义冲突
- **WHEN** 架构定义发生变更
- **THEN** 开发者仅需修改 `ARCHITECTURE.md`，所有引用处通过链接保持一致，避免认知幻觉
