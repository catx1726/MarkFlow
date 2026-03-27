---
name: workshop-initializing
description: Use when onboarding a Workshop to SOP 2.0 with link self-healing, multi-foundry support, and asset distillation & contribution whitelist.
mode: step-by-step
---

# Workshop Initializing (Sub-Project Alignment)

## Overview
本技能定义了子项目（Workshop）接入 SOP 2.0 的链路协议。其核心是确保子库能够通过 **拷贝 (Copy)** 机制获取母库资产，并在环境限制时提供清晰的报告与指导。

## Implementation Workflow (Step-by-Step)

### 0. Physical Security & Git Isolation (Mandatory)
- [ ] **物理隔离注入**：
  - **ACTION**：检测子库根目录 `.gitignore`。
  - **INJECTION**：物理追加（防止 Git 穿透删除）：
    ```text
    # YOU-DRIVE-SOP Physical Links
    .gemini/skills/
    .gemini/commands/
    patterns/
    openspec/specs/
    .gemini/link.json
    ARCHITECTURE.md
    global_standard.md
    GETTING_STARTED.md
    SOP_CORE_MANUAL.md
    GEMINI.md
    ```
  - **VERIFICATION**：运行 `git check-ignore ARCHITECTURE.md` 确认生效。

### 1. Asset Distribution Strategy (Primary Enforcement)
- [ ] **全量资产拷贝 (The Asset Manifest)**：
  - **ACTION**：AI **必须**执行文件拷贝机制。考虑到执行环境的安全工作区限制（“Path not in workspace”），直接使用 OS 链接跨工作区访问不可靠。因此，AI 将把以下 9 个核心物理对象直接拷贝到子库的工作区内：
    1.  **DIRECTORY**: `.gemini/skills/`
    2.  **DIRECTORY**: `.gemini/commands/`
    3.  **DIRECTORY**: `patterns/`
    4.  **DIRECTORY**: `openspec/specs/`
    5.  **FILE**: `ARCHITECTURE.md`
    6.  **FILE**: `global_standard.md`
    7.  **FILE**: `GETTING_STARTED.md`
    8.  **FILE**: `SOP_CORE_MANUAL.md`
    9.  **FILE**: `GEMINI.md`
  - **COMMAND**: `Copy-Item -Recurse -Destination .` (根据实际环境调整目标路径)
  - **VERIFICATION**：AI **必须**在拷贝后验证关键文件的存在性（例如，检查 `ARCHITECTURE.md` 是否存在于子库的根目录）。
  - **REPORT**: AI **必须**向用户明确报告物理状态：`[COPIED (静态副本)]`。若拷贝因任何原因失败，AI 必须报告错误并请求用户介入。

### 2. Identity Injection (Workshop Status)
- [ ] **物理身份写入**：在子库根目录创建 `role.json`。
  - **CONTENT**: `{"role": "workshop", "foundry_root": "{{FOUNDRY_ROOT}}", "status": "operational"}` (注意：`foundry_link` 变为 `foundry_root`，且指向拷贝后子库内相对母库的逻辑路径或直接指明为已拷贝状态)
- [ ] **AI 身份觉醒**: AI 在启动会话时，**必须**首先读取 `role.json`。
- [ ] **角色报告 (Mandatory)**：若检测到 `role: "workshop"`，AI **必须**向用户物理确认：“我当前位于 Workshop 子库，已通过文件拷贝获取母库核心资产，已准备好执行标准 SOP 2.0 任务。”

### 3. Final Synthesis & Handover
- [ ] **物理重载 (Force Registry Reload)**: AI **必须**告知用户：『初始化完成，为了使新的 Skill 和 Command 生效，请物理重启会话 (运行 `/exit` 后重新执行 `gemini`)。』
- [ ] **规约审计清单**：输出 Markdown 表格，列出当前子库已通过拷贝的 **全量规约清单**（而非链接列表）。
- [ ] **交互式引导**：询问：『您是想：A) 扫描旧项目 (提纯) 还是 B) 开发新功能 (Apply)？』

---
*YOU-DRIVE-SOP - 驱动规约，掌握智力。*
