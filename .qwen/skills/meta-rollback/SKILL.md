---
name: meta-rollback
description: Use when needing to undo recent AI operations or revert the repository to a specific historical commit based on the ops_changelog.
---

# Meta Rollback (State Recovery Expert)

## Overview
本技能负责在发生误操作或需要回溯实验进度时，安全、精准地恢复系统状态。它通过解析 `ops_changelog.md` 提供的三级回滚指令，确保开发者拥有 100% 的“后悔权”。

## Multi-Level Rollback (ABC Compatibility)

### L1: 语义撤销 (Semantic Undo)
- **Trigger**: 用户输入 “撤销上一步”、“回滚最后一次修改”。
- **Action**: AI 读取 `ops_changelog.md` 最后一行，提取 `Undo_CMD` 并执行。
- **Effect**: 撤销最近一次提交或文件操作。

### L2: 指令透明撤销 (Instruction Mapping)
- **Trigger**: 写操作执行后。
- **Action**: AI 在确认操作成功的同时，静默展示对应的撤销代码块。
- **Effect**: 用户可随时手动复制执行 `git checkout -- <file>`。

### L3: 精确历史回溯 (Commit Revert)
- **Trigger**: 用户输入 “回滚至指定时间点”、“查看历史并回退”。
- **Action**: 
  1. 展示最近 5 条带语义原因的 Changelog。
  2. 用户选择 Commit ID。
  3. AI 执行 `git reset --soft <COMMIT_ID>` (保留代码供审查) 或 `git reset --hard` (彻底回退)。

## Implementation Workflow

1. **Scan**: 读取 `.gemini/ops_changelog.md` 获取最新的审计快照。
2. **Context Check**: 执行 `git status` 确保回滚不会导致非 AI 操作的代码丢失。
3. **Execution**: 执行回滚命令。
4. **Log Patch**: 在 Changelog 中记录一次 `ROLLBACK` 动作。

## Common Mistakes
- **硬回滚 (Hard Reset)**：在未告知后果的情况下直接执行 `--hard`，导致用户未保存的工作丢失。*修正：默认优先使用 --soft。*
- **状态不同步**：回滚后未刷新当前文件的读取状态。

## Red Flags
- 在没有 Git 管理的项目中尝试回滚。
- 回滚指令与 Changelog 记录的 Commit ID 不匹配。
