## ADDED Requirements

### Requirement: Windows 权限闭环处理
系统 SHALL 在执行物理链路挂载前验证创建权限。

#### Scenario: 权限不足引导
- **WHEN** 执行 `gemini skills link` 报错 `Access Denied`
- **THEN** AI 停止任务并输出特定的“Windows 开发者模式开启指引”。

### Requirement: 绝对路径持久化
系统 SHALL 确保 `.gemini/link.json` 中的 `foundry_root` 为物理绝对路径。

#### Scenario: 路径归一化
- **WHEN** 探测到母库路径
- **THEN** 执行路径转换，确保存入文件的字符串不含 `..` 等相对标识。
