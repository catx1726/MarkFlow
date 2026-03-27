---
name: openspec-decisions
description: Use when recording a new Architecture Decision Record (ADR), technical trade-off, or SOP 2.0 evolution consensus in Mother-Base.
---

# OpenSpec Decisions (ADR)

## Overview
本技能负责在母库（Foundry）中记录架构决策流。所有“宪法级”变动、跨库对齐中的技术妥协或全局 SOP 演进，必须通过此 Skill 固化为 ADR。

## When to Use
- 确立新的全局开发标准（如：强制 TDD）。
- 记录子库在收割资产时的技术偏差（如：Vue 2 兼容性妥协）。
- 修改母库物理结构或元技能（Meta-Skills）逻辑。

## Core Pattern: ADR Structure
每份决策必须包含以下原子化字段：
- **ID & Title**: `00X-short-description.md`。
- **Status**: Proposed / Accepted / Superseded / Deprecated。
- **Context**: 决策背景（遇到了什么问题？子库的环境约束是什么？）。
- **Decision**: 最终选择的方案（必须清晰、无歧义）。
- **Consequences**: 决策后果（带来了什么好处？引入了什么新的约束？）。
- **Related Sub-Project**: （可选）关联的子库 ID 或路径。

## Implementation Workflow

### 1. Decision Creation
- 在 `openspec/decisions/` 下创建新文件。
- 使用 `openspec/schemas/decision_schema.md` 作为模板。
- **Constraint**: 决策描述必须是原子化的，避免在同一份 ADR 中混杂多个不相关的决策。

### 2. Evolution Sync
- 决策达成后，AI 必须自问：『此决策是否影响现有的 Skill 文档？』
- 若影响，立即执行 `activate_skill writing-skills` 对相关 `.md` 文件进行增量 Patch。

## Common Mistakes
- **叙述过于宽泛**：写成了工作日志而不是架构决策。*修正：聚焦于“选择”及其“后果”。*
- **缺失 Consequences**：只说怎么做，不说会造成什么限制。
- **未关联子库**：在处理跨项目冲突时，未标注该决策是为了适配哪个特定环境。

## Red Flags
- 在未生成 ADR 的情况下私自更改全局 `global_standard.md`。
- ADR 内容与 `env_schema.md` 存在冲突且未在文档中说明。
