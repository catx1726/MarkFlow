---
name: openspec-changes-archive
description: Use when archiving a completed change or task, capturing the session snapshot, and reflecting on asset distillation & contribution in the SOP 2.0 lifecycle.
---

# OpenSpec Changes Archive (Task Snapshot)

## Overview
本技能负责将已完成的任务从活跃状态转入归档区。它执行“管理档案（Governance）”与“执行记录（Operations）”的物理分流存储，确保项目演进有据可查且过程透明。

## Core Pattern: Dual-Track Archiving
1. **Governance Target**: `openspec/changes/archive/governance/YYYY-MM-DD-<name>/`。
2. **Operations Target**: `openspec/operations/archive/YYYY-MM-DD-<name>/`。
3. **Contribution Gate (Mandatory)**: 归档前必须调用 `activate_skill meta-distiller` 执行提纯逻辑。

## Implementation Workflow

### 1. Pre-Archive Audit
- 执行 `openspec list` 获取活跃任务清单。
- **Staging Check**: 扫描 `.gemini/distill_stage/` 暂存资产。
- **Re-verification Check**: 若检测到暂存资产，AI 必须确认其是否已通过 `meta-distiller` 定义的“母库复验”。未通过复验（即测试未全绿）的资产严禁执行合并入库。
- **Ops Check**: 读取子库本地 `.gemini/ops_changelog.md`。

### 2. Archiving Process
- **OpenSpec Archive Command**:
  ```bash
  npx openspec archive "<name>" --yes
  ```
- **Mandatory Physical Partitioning (Post-OpenSpec)**:
  由于 `openspec` CLI 默认归档至根目录 `archive/`，AI **必须** 根据任务属性执行物理分流：
  - **Governance Move**: 若涉及规约、决策或元技能变更，执行以下物理指令：
    ```bash
    mkdir -p openspec/changes/archive/governance/<YYYY-MM-DD-name>/
    mv openspec/changes/archive/<YYYY-MM-DD-name>/* openspec/changes/archive/governance/<YYYY-MM-DD-name>/
    Remove-Item -Path "openspec/changes/archive/<YYYY-MM-DD-name>/" -Recurse -Force
    ```
- **Operations Move**:
  ```bash
  mkdir -p openspec/operations/archive/<YYYY-MM-DD-name>/
  mv .gemini/ops_changelog.md openspec/operations/archive/<YYYY-MM-DD-name>/
  ```


### 3. Post-Archive Reporting
- 生成存档摘要：
    - **任务名称**：`<change-name>`
    - **资产同步**：列出已并入母库的 Pattern 与 Skill。
    - **操作快照**：确认 Changelog 已迁移至审计库。

## Common Mistakes
- **混合存档**：将操作级日志塞进管理层文件夹。*修正：必须执行物理分流。*
- **未清空暂存区**：在 Staging 还有内容时直接归档。

## Red Flags
- 归档后子库根目录仍残留 `ops_changelog.md`。
- 归档路径未包含 `governance` 或 `operations` 分类标识。
