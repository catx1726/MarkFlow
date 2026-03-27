## ADDED Requirements

### Requirement: 母库自进化配置 (Foundry-as-Workshop)
系统 SHALL 支持母库作为自身的子库进行自进化演进。母库开发者可通过将本地路径配置为 `FOUNDRY_PATH`，实现对 `skills/` 和 `patterns/` 的提纯、同步与归档。

#### Scenario: 递归资产同步
- **WHEN** 开发者配置本地母库为同步源，并执行 `workshop-sync`
- **THEN** 系统 SHALL 识别源路径与目标路径一致，并安全跳过或执行逻辑对齐，不产生物理损坏

### Requirement: 自进化模式操作指南 (Recursive Mode Guide)
系统 SHALL 在 `GETTING_STARTED.md` 中显式说明母库如何作为子库参与 SOP 生命周期。指南 MUST 包含 `OpenSpec` 流程在母库演进中的强制性、配置示例以及常见陷阱规避（如循环引用）。

#### Scenario: 用户执行自进化任务
- **WHEN** 用户尝试修改母库本身的 `SKILL.md`
- **THEN** 用户能够从 `GETTING_STARTED.md` 中找到明确的提案、执行与归档路径
