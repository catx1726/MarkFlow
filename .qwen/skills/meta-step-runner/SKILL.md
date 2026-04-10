---
name: meta-step-runner
description: Use when a skill is marked with 'mode: step-by-step' to manage atomic execution, physical state persistence, and user-led progression.
---

# Meta Step Runner (Task Control Protocol)

## Overview
本技能是复杂技能（Complex Skills）的元控制逻辑。它将单一的、长篇累牍的指令执行转变为可控制、可观测、具备物理记忆的分步步进流（Atomic Progression）。

## When to Use
- 执行标记有 `mode: step-by-step` 的技能。
- 处理步骤超过 3 步且包含物理文件操作的高风险任务。
- 需要在长对话中保持执行进度不丢失。

## Core Pattern: Physical Checkpoints
1. **State Persistence**: 在 `.gemini/skill_progress.md` 中维护当前任务的“物理存根”。
2. **Atomic Step-through**: 每回合只执行一个 `[ ]` 任务块。
3. **User-in-the-loop**: 强制在每步完成后暂停，等待用户显式确认。

## Implementation Workflow

### 1. Initialization (The Handshake)
- **Action**: 检测到 `mode: step-by-step` 标志。
- **Output**: 生成物理进度条文件 `.gemini/skill_progress.md`。
- **Dependency Analysis (Upstream Logic)**: AI 必须分析步骤间的 `unlocks` 关系。例如：Step 2 依赖 Step 1 的文件产出。
- **Prompt**: 
  > **「分步模式激活」**：
  > 1. [ ] 步骤 A (已解锁)
  > 2. [ ] 步骤 B (锁定：等待 A 完成)
  > 请确认计划并输入 `next` 开始。

### 2. Execution Loop
- **Pre-action (Context Refresh)**: 
  - 每一回合开始前必须执行 `read_file .gemini/skill_progress.md` 找回任务进度。
  - **滚动聚合 (Rolling Aggregation)**：若当前技能涉及文档或代码资产生成，必须同时执行 `read_file` 读取当前已生成的全量产物作为上下文背景。
- **Action**: 执行当前第一个 `[ ]` 任务。
- **Post-action (Write-Through)**: 
  - 任务产物必须立即执行 `write_file` 或 `replace` 落地物理文件（严禁仅保留内存草稿）。
  - 更新物理进度文件，将 `[ ]` 标记为 `[x]`。
  - 报告结果并询问：“Step N complete. Proceed to next?”

### 3. Final Synthesis & Cleanup
- **Quality Audit**: 在所有功能步 `[x]` 后，必须执行一个强制性的“终期质量审计”任务：
  - 通读全篇产物，检查术语一致性、逻辑连贯性。
  - **厚度校验**：确保细节覆盖度优于单一输出 baseline，防止因分步导致的内容缩水。
- **Cleanup**: 审计通过后，物理删除 `.gemini/skill_progress.md`。
- **Final Report**: 提交完整的执行报告。

## Resumption Logic
若 AI 检测到 `.gemini/skill_progress.md` 已存在：
- **MUST**: 优先读取该文件。
- **MUST**: 主动询问：“检测到未完成的技能执行任务，是否恢复进度？”

## Red Flags
- 忽略分步标志，一次性执行所有步骤。
- 在任务未全部打钩前，擅自删除 `.gemini/skill_progress.md`。
- 连续两回合不读取进度文件导致进度跑偏。
