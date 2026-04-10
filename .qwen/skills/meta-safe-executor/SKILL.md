---
name: meta-safe-executor
description: Use when performing write operations (CREATE, UPDATE, DELETE, MOVE) to ensure Git-based safety snapshots, semantic logging, and destructive action confirmation.
---

# Meta Safe Executor (Production Safety Protocol)

## Overview
本技能是 SOP 2.0 体系的“生产保险丝”。它通过在所有写操作前强制执行 Git 快照、记录语义化日志（Changelog），并为破坏性动作提供物理熔断（确认弹窗），确保 AI 的每一个动作都处于受控且可回滚的状态。

## When to Use
- 执行任何涉及文件修改的指令（`write_file`, `replace`, `run_shell_command` 修改文件等）。
- 执行破坏性操作（`rm`, `mv`, `Clear-Content`）。
- 需要为当前任务建立详细的操作审计链。

## Core Pattern: The Sentinel Loop
1. **Git Sentinel**: 写操作前必须确保当前状态已 Commit。
2. **Semantic Logging**: 在 `.gemini/ops_changelog.md` 记录操作意图。
3. **Safe Gate**: 破坏性动作强制弹窗确认。

## Implementation Workflow (Mandatory Audit Lock)

### 0. Mandatory Pre-Write Protocol (Audit Lock)
**在执行任何写操作 (`write_file`, `replace`, `run_shell_command` 修改文件) 之前，AI 必须物理执行：**
1.  **READ-LOG**: `read_file .gemini/ops_changelog.md` 确认审计表已就绪。
2.  **PHYSICAL LOG**: 追加操作意图到 `.gemini/ops_changelog.md`。
3.  **VERIFY**: 确认日志持久化后再进行后续动作。

### 1. Pre-operation Backup (Git Auto-Save)
- **Check**: 执行 `git status --porcelain`。
- **Action**: 若有未提交改动，执行：
  ```powershell
  git add -A; git commit -m "AI_AUTO_SNAP: [Pre-Op Backup] <Short Reason>" --allow-empty
  ```

### 2. Operation Audit (Changelog)
- 在 `.gemini/ops_changelog.md` 追加记录：
  | Time | Action | Target | Reason | Commit_ID | Undo_CMD |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | {{NOW}} | {{ACTION}} | {{PATH}} | {{INTENT}} | {{HEAD_ID}} | {{RECOVERY_CMD}} |


### 3. Destructive Action Guard (Safe Gate)
- **Target**: `rm`, `Remove-Item`, `mv` (rename/move), `Clear-Content`.
- **Logic**: 必须停止当前步骤，输出警报并等待用户确认：
  > **⚠️ [破坏性动作警告]**
  > **意图**：{{REASON}}
  > **指令**：`{{CMD}}`
  > **后果**：将永久修改或删除该物理资产。
  > **确认执行？[Y/N]**

## Cleanup
- 归档时由 `openspec-changes-archive` 负责将日志迁移至 `openspec/operations/` 审计库。

## Red Flags
- 绕过 Git 状态检查直接执行写操作。
- 执行删除指令而未触发弹窗确认。
- Changelog 记录缺失 `Reason` 或 `Undo_CMD`。
