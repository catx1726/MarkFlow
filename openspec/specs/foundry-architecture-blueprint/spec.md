## ADDED Requirements

### Requirement: SOP 2.0 三层架构图 (SOP 2.0 3-Layer Architecture)
`SOP_CORE_MANUAL.md` 必须在首页通过 ASCII/Mermaid 图表展示“实验室-变更-资产”的三层流动架构。

#### Scenario: 架构图可见性
- **WHEN** 用户或 AI 阅读 `SOP_CORE_MANUAL.md`。
- **THEN** 必须能在第一章前看到明确的三层物理架构图。

### Requirement: 角色基准文档 (Role-Based Documentation)
`GETTING_STARTED.md` 必须按照“Foundry Manager”和“Asset Harvester”两个角色进行重构，提供清晰的分流操作指引。

#### Scenario: 角色引导
- **WHEN** 用户打开 `GETTING_STARTED.md`。
- **THEN** 必须能看到“我是母库管理员”和“我是业务开发者”两个明确的入口。
