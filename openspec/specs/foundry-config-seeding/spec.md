## ADDED Requirements

### Requirement: 完整母库配置种子生成
系统 SHALL 在母库初始化时，自动物理创建 `openspec/config_foundry.yaml`。

#### Scenario: 种子内容完整性
- **WHEN** 执行 `activate_skill foundry-initializing`
- **THEN** 生成的文件必须包含：
    - `context`: 包含 SOP 2.0 框架说明。
    - `rules`: 包含 TDD、安全性与合规性规则。
    - `templates: tasks`: 包含“## 1. 规约与环境自检”章节。

### Requirement: 配置自愈能力
当 `config_foundry.yaml` 被删除或损坏时，初始化技能 SHALL 能通过再次运行恢复核心字段。

#### Scenario: 增量修复
- **WHEN** 配置文件已存在但缺失 `templates` 字段
- **THEN** 系统物理追加缺失字段并向用户报告修复情况。
