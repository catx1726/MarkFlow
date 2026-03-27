## ADDED Requirements

### Requirement: 核心规约种子自动生成
当母库 (Foundry) 缺失关键生产规约（如 `vcs-lifecycle-automation`）时，系统 SHALL 自动基于内置模板生成种子规约，确保子库初始化时有据可依。

#### Scenario: 缺失规约自动生成
- **WHEN** 执行 `activate_skill foundry-initializing` 且 `openspec/specs/vcs-lifecycle-automation/` 不存在
- **THEN** 系统在对应路径创建物理文件夹，并注入标准的 `spec.md` 模板。

### Requirement: 逻辑刚性宪法对齐
系统 SHALL 确保母库根目录下的 `.gemini/global_standard.md` 包含最新的 SOP 2.0 “提纯-反哺”闭环规约。

#### Scenario: 宪法缺失自动补全
- **WHEN** 执行初始化且 `global_standard.md` 不存在或逻辑过时
- **THEN** 系统物理更新宪法内容并报告版本差异。
