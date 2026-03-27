## ADDED Requirements

### Requirement: Meta-Distiller 微观流程可视化
系统 SHALL 在 `ARCHITECTURE.md` 中增加 `meta-distiller` 的提纯微观流程图。图表 MUST 包含：扫描 (Scan)、识别 (Identify)、脱水 (Dehydrate)、暂存 (Stage) 以及反馈归档 (Foundry-Refeed) 等步骤。

#### Scenario: 资产提纯动作引导
- **WHEN** AI 引擎运行 `meta-distiller` 技能
- **THEN** AI 引擎能够依照 `ARCHITECTURE.md` 中的图示步骤，有序执行从 Workshop 到 Foundry 的数据转移与规范化

### Requirement: OpenSpec 状态机微观流程可视化
系统 SHALL 绘制 OpenSpec 变更状态机的微观图。图表 MUST 包含：提案 (Propose)、探索 (Explore)、执行 (Apply)、审核 (Review)、归档 (Archive) 以及撤销 (Rollback) 等状态与转换逻辑。

#### Scenario: 任务生命周期管理
- **WHEN** 开发者使用 `/opsx` 系列命令
- **THEN** 开发者能够通过图示清晰理解当前任务处于哪一阶段，以及下一步合法动作
