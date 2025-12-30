# AI 协作与工程强规则

## 1. 代码风格 (Style Guide)

- **Prettier 配置**：必须遵循项目根目录 `.prettierrc`（或你代码块中定义的单引号、无分号、120 字符等）。

## 2. 架构约束 (Architecture)

## 3. 健壮性与 TDD (Robustness)

## 4. AI 归档规范 (SOP Compliance)

- **同步要求**：代码逻辑发生重大变更后，必须同步更新 `.ai/archive/` 下对应的 MD 文档。
- **自检检查清单**：每次输出代码前，请对照本规则检查是否违反了“引用隔离”和“状态闭环”原则。
