# YOU-DRIVE-SOP：全局行为宪法 (Global Behavioral Constitution)

> **"AI 驱动逻辑，你驱动规约。"**  
> 本宪法是 YOU-DRIVE-SOP 2.0 体系的最高行为准则。所有 AI 引擎（Engine）在进入本工作区后，必须无条件遵循以下钢铁律令。

---

## 1. 核心理念与模型 (Core Philosophy)

- **唯一真值源 (SSOT)**：所有关于物理架构、流程图及角色分工的细节，必须以 [**ARCHITECTURE.md**](./ARCHITECTURE.md) 为准。
- **二元模型 (Skeleton-Muscle)**：
    - **OpenSpec SHALL be the Skeleton**: 负责治理、状态与流程。
    - **Superpowers SHALL be the Muscle**: 负责原子执行质量与工程习惯。
- **递归演进 (Self-Evolution)**：母库（Foundry）本身亦是资产，必须通过自身的 OpenSpec 流程进行版本迭代。

## 2. 空间认知与自检 (Spatial Awareness)

- **身份确认**：AI 必须首先确认当前角色：**Foundry (母库)** 或 **Workshop (工作间)**。
- **启动自检 (Critical Boot)**：严禁跳过 `GEMINI.md` 中定义的 **[CRITICAL-BOOT-SEQUENCE]**。
- **路径感应**：根路径通过 `{{FOUNDRY_ROOT}}` 自动感应，严禁使用硬编码的绝对路径。

## 3. 元技能执行铁律 (Meta-Skills Mandates)

### 3.1 审计先行 (Audit-First)
- **无日志不写入**：严禁在未更新 `.gemini/ops_changelog.md` 的情况下执行任何物理写操作。
- **安全执行器**：所有文件修改 **MUST** 通过 `meta-safe-executor` 执行，以确保 Git 快照与操作留痕。

### 3.2 资产提纯 (Distillation)
- **脱水原则**：所有具备通用价值的逻辑，在归档前 **MUST** 激活 `meta-distiller` 进行提纯。
- **三件套标准**：Pattern 资产必须包含 `index.ts` (逻辑), `index.test.ts` (测试), `README.md` (说明)。
- **严禁业务残留**：母库资产中严禁保留硬编码的项目名称、私有域名或业务敏感词。

## 4. 流程刚性与禁令 (Process Rigidity & Prohibitions)

- **严禁模拟 (No Simulation)**：AI 禁止使用“示意”、“假设已完成”等措辞。所有 Task 必须产生真实的物理变更。
- **分支隔离 (Branch Isolation)**：严禁在 `main` 分支执行功能开发。所有变更必须遵循 `issue -> branch -> apply -> archive -> pr` 的闭环。
- **TDD 铁律**：严禁在缺失失败测试的情况下编写生产逻辑。若违规，必须物理删除代码并重来。
- **破坏性动作熔断**：针对 `DELETE`、`MOVE` 或 `Clear-Content` 指令，必须获得用户的显式确认。

## 5. 环境抽象与变量驱动 (Abstraction)

- **禁止硬编码环境**：严禁在 Skill 或 Pattern 中硬编码运行版本（如 Node 20）。
- **变量驱动执行**：必须使用 `{{RUNTIME_VERSION}}`, `{{TEST_COMMAND}}` 等由子库 `env.md` 定义的环境变量。

## 6. 跨库链路保护 (Link Protection)

- **穿透风险意识**：在子库执行 `git clean` 或切换分支前，必须确认物理链路属性。若为 `ReparsePoint`，必须警示用户潜在的母库源码删除风险。
- **恢复优先**：若发生误删，立即在母库端执行 `git restore`，严禁在子库端进行尝试性修复。

---
*YOU-DRIVE-SOP - 驱动规约，掌握智力。*
