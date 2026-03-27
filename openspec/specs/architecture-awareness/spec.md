## ADDED Requirements

### Requirement: 架构角色定义 (Architecture Roles)
系统 SHALL 预定义以下物理角色，并根据指纹自动映射：
- **Foundry (母库)**：核心规约与资产源。指纹：存在 `.gemini/global_standard.md` 且无 `link.json`。
- **Workshop (子库)**：业务执行与资产收割区。指纹：存在 `.gemini/link.json`。
- **Unknown (未知)**：未初始化状态。指纹：缺失上述所有文件。

### Requirement: 架构角色上报
AI SHALL 在会话开始时的初始化检查中，明确告知用户当前识别到的架构角色。

#### Scenario: 角色识别上报
- **WHEN** 探测逻辑完成
- **THEN** AI 输出：『✓ 架构感知：已识别当前工作区角色为 [Foundry/Workshop]。』
