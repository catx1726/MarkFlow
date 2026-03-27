---
name: workshop-sync
description: Use to reliably synchronize latest Skills and Patterns from Foundry to a Copied Workshop, ensuring intelligence alignment.
---

# Workshop Sync (Intelligence Pull Protocol)

## Overview
当子库由于环境限制采用 **Copied (静态副本)** 模式时，智力继承的实时链路已失效。本技能提供了一套可靠的物理同步机制，允许用户主动从母库拉取最新的“大脑”（Skills）与“肌肉”（Patterns），确保子库与母库的核心资产和规约保持一致。

## When to Use
- 在 `link.json` 中 `link_type` 为 `copy` 时，用于获取母库最新资产。
- 想要重置或更新本地技能库至母库最新状态时。
- 发现本地核心文档或资产与母库不一致时。

## Implementation Workflow (Step-by-Step)

### 1. Source Identification
- [ ] **读取路径**：AI 必须首先读取 `.gemini/link.json` 中的 `foundry_root`。
- [ ] **路径验证**：验证母库路径是否物理存在。若不存在，AI 需报告错误并请求用户提供有效路径。

### 2. Physical Sync (Full Intellectual Alignment)
AI **必须**执行物理拷贝，确保子库的规约逻辑与母库 100% 对齐。此过程将覆盖目标路径中的同名文件和目录。

- [ ] **同步智力组件**：
  ```bash
  # 1. 大脑与肌肉 (Skills & Patterns)
  xcopy "{{FOUNDRY_ROOT}}\.gemini\skills" .gemini\skills /E /I /Y
  xcopy "{{FOUNDRY_ROOT}}\patterns" patterns /E /I /Y

  # 2. 治理协议与模板 (Core Governance & Config)
  xcopy "{{FOUNDRY_ROOT}}\openspec\specs" openspec\specs /E /I /Y
  xcopy "{{FOUNDRY_ROOT}}\openspec\schemas" openspec\schemas /E /I /Y

  # 3. 根部核心看板与宪法 (Essential Docs)
  xcopy "{{FOUNDRY_ROOT}}\global_standard.md" . /Y /D
  xcopy "{{FOUNDRY_ROOT}}\AGENTS.md" . /Y /D
  xcopy "{{FOUNDRY_ROOT}}\GETTING_STARTED.md" . /Y /D
  xcopy "{{FOUNDRY_ROOT}}\SOP_CORE_MANUAL.md" . /Y /D
  xcopy "{{FOUNDRY_ROOT}}\GEMINI.md" . /Y /D
  ```
  *注：
  - `/E`: 拷贝目录和子目录，包括空目录。
  - `/I`: 当目标不存在且源是目录时，假定目标为目录。
  - `/Y`: 覆盖现有文件而不提示。
  - `/D`: **[注意]** 此参数仅拷贝源文件比目标文件新的文件。若要确保完全同步母库状态，建议移除 `/D` 或在特定情况下（如用户明确要求保留本地更改）再使用。为了保证一致性，此脚本默认执行覆盖操作。*

### 3. Verification
- [ ] **文件校验**:
  - **ACTION**: AI 需根据已知的核心文件列表 (如 `ARCHITECTURE.md`, `GEMINI.md`, `.gemini/global_standard.md`)，检查它们是否已成功拷贝至目标位置。
  - **AI OPERATION**: 运行 `Test-Path` (PowerShell) 或类似命令来验证文件/目录的存在。
- [ ] **审计记录**: 在 `.gemini/ops_changelog.md` 中记录本次同步的详细信息（时间、来源、同步项、校验结果）。
- [ ] **状态报告**：
  - **AI OPERATION**: 详细报告本次操作：
    - 同步模式：`[COPIED & SYNCED]`
    - 同步的文件/目录数量
    - 校验结果（成功/失败，发现的问题）
    - 建议用户执行 `git status` 以检查本地工作区变更。

## Red Flags
- **未经验证的同步**: 未执行拷贝后校验，导致用户以为同步成功但实际资产不完整。
- **同步过程中断**: 未妥善处理 `xcopy` 失败，导致部分资产丢失或损坏。
- **与本地更改的冲突**: 默认覆盖行为可能覆盖用户在本地 Workshop 中已做的、但未提交的修改。若需保留本地更改，需谨慎使用或提供用户确认选项。
---
