## ADDED Requirements

### Requirement: 物理链路自举 (Skill Bootstrap)
系统 SHALL 确保在执行 `workshop-initializing` 前已建立有效的物理技能链路。
- **验证逻辑**：检查 AI 技能库中是否存在 `workshop-initializing`。
- **拒绝策略**：若缺失，系统必须输出 `gemini skills link` 指令并引导用户手动执行。

### Requirement: 规约全量物理同步
系统 SHALL 递归同步母库 `openspec/` 下的 `specs/`, `schemas/`, `protocols/` 至子库对应路径。

#### Scenario: 子库规约同步
- **WHEN** 执行 `activate_skill workshop-initializing` 成功探测到母库路径
- **THEN** 物理拷贝 `openspec/specs` 目录下所有文件至子库（跳过 Git 敏感文件）。

### Requirement: 初始化物理审计上报
初始化完成后，系统 SHALL 扫描子库物理文件，输出已同步的“能力清单”。

#### Scenario: 审计报告生成
- **WHEN** 所有物理拷贝动作完成
- **THEN** 输出 Markdown 表格列出所有已成功同步的规约子目录。

### Requirement: 物理链路状态透明度 (Hybrid Link Handler)
系统 SHALL 自动识别物理映射类型并向用户汇报。
- **Linked (实时同步)**：基于 Junction/Symlink 建立。母库变更实时生效。
- **Copied (静态副本)**：基于物理拷贝建立。母库变更需手动重新同步。
- **风险告知**：在 Copied 模式下，系统必须警告用户智力继承已断裂。

### Requirement: 动态状态感知 (GEMINI.md)
系统 SHALL 在子库 `GEMINI.md` 中注入可执行的查询指令，告知用户如何通过 AI 确认当前同步状态。

#### Scenario: 动态看板注入
- **WHEN** 生成子库 `GEMINI.md`
- **THEN** 包含“目前初始化状态如何？”等标准指令示例。
