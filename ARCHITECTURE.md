# YOU-DRIVE-SOP 2.0 架构与流程规约 (System Architecture)

本文档定义了 **YOU-DRIVE-SOP 2.0 (智力演进实验室)** 的物理架构设计、智力资产循环流程以及核心执行引擎的二元协作模型。

---

## 1. 逻辑架构图 (Logic Architecture)

该图描述了系统如何组织治理宪法、智力资产库、执行引擎以及外部业务项目（Workshop）之间的物理关系。

```mermaid
graph TD
    subgraph Governance [治理与宪法 - Governance]
        GS["宪法 (.gemini/global_standard.md)"]
        CM["核心手册 (SOP_CORE_MANUAL.md)"]
        OC["审计日志 (.gemini/ops_changelog.md)"]
    end

    subgraph Intelligence [智力资产层 - Assets]
        SK["AI 技能库 (.gemini/skills/)"]
        PT["设计模式 (patterns/)"]
        OS["治理协议 (openspec/)"]
    end

    subgraph Engine [执行与提纯 - Engine]
        subgraph Skeleton [治理骨架 - State Layer]
            OS_ENG["OpenSpec Engine (Propose/Archive)"]
            GH_CI["CI/CD Guardrails (PR Summary)"]
        end
        subgraph Muscle [执行肌肉 - Action Layer]
            subgraph MetaSkills [核心元技能 - Meta Skills]
                MD["资产提纯 (meta-distiller)"]
                MSE["安全执行 (meta-safe-executor)"]
            end
            SP_ENG["Superpowers Skills (TDD/Debug/Plan)"]
        end

        Skeleton --> Muscle
        SP_ENG --> MSE
        MD --> MSE
    end

    Governance --> Engine
    Engine --> Intelligence
    Intelligence -.-> |智力分发/资产收割| Workshop["业务项目 (Workshop)"]
```

---

## 2. 治理与执行的二元关系 (Skeleton-Muscle Model)

为了确保 AI 引擎既具备严谨的流程控制，又具备高效的执行能力，系统采用**“骨架-肌肉”**二元模型：

### 2.1 治理骨架 (Skeleton: OpenSpec + CI)

- **职责**：管理变更的状态、决策与生命周期，并通过自动化脚本强制执行。
- **规划层级**：**治理/策略规划 (Strategic Planning)** —— 决定“去哪 (What & Why)”。
- **核心产出**：Proposal (提案) 与 Specs (规约)。它定义了任务的结构边界。
- **自动化守门人**：GitHub Actions (`pr_summary.yml`) 会物理检查每一项 PR 是否已在 `openspec/changes/archive/` 下完成归档。

### 2.2 执行肌肉 (Muscle: Superpowers)

- **职责**：提供原子级的工程执行技能与铁律。
- **规划层级**：**执行/战术规划 (Tactical Planning)** —— 决定“怎么走 (How)”。
- **核心产出**：Task List (任务清单)。即使是 `writing-plans` 技能，也是为了驱动物理执行而进行的战术协调。
- **核心技能**：`writing-plans`, `test-driven-development` (TDD 铁律), `systematic-debugging` (系统化调试)。

---

## 3. 智力演进生命周期 (Evolution Lifecycle)

### 3.1 宏观循环 (Macro Loop)

描述“业务实践”如何被提炼为“通用资产”并反馈回业务。

```mermaid
sequenceDiagram
    participant W as Workshop (业务前端)
    participant AI as SOP Agent (执行引擎)
    participant F as Foundry (母库/本仓库)

    Note over W, AI: 资产发现 (Detection)
    W->>AI: 完成高价值业务逻辑开发
    AI->>AI: 识别潜在可复用 SOP (meta-distiller)

    Note over AI, F: 提纯归档 (Distillation)
    AI->>F: 将逻辑“脱水”提纯至 Staging 区域
    F->>F: OpenSpec 决策审核与资产转化 (ADR)
    F->>F: 更新核心技能库与模式库

    Note over F, W: 智力分发 (Distribution)
    F->>W: 执行同步协议 (workshop-sync)
    W->>W: 自动挂载最新的 AI 增强技能
```

### 3.2 微观流程：资产提纯 (Meta-Distiller Flow)

描述逻辑如何从业务代码中剥离并并入母库。

```mermaid
graph LR
    Scan[扫描代码] --> Identify[识别潜力]
    Identify --> Dehydrate[逻辑脱水/参数化]
    Dehydrate --> Stage[暂存 distill_stage]
    Stage --> Verify[母库复验/TDD]
    Verify --> Refeed[归档入库/Foundry]
```

### 3.3 微观流程：13 步生产生命周期 (The 13-Step Protocol) - **优化版**

描述一个任务从需求探索到代码合并的全流程物理轨迹，深度融合 Superpowers 以确保工程质量，并明确人机交互与错误处理。

```mermaid
sequenceDiagram
    autonumber
    participant D as Driver (用户)
    participant AI as Engine (AI 引擎)
    participant VCS as Git/GitHub
    participant F as Foundry (母库)

    Note over D, AI: 1-3. 启动阶段 (Launch)
    AI->>AI: activate_skill brainstorming (需求探索)<br/><i>(AI 暂停，等待 Driver 确认初步方案)</i>
    D->>AI: 提供 Issue ID (通过 gh issue create 后通知/输入)
    AI->>VCS: git checkout -b issue-N (分支隔离)<br/><i>(若失败，AI 报告给 Driver，等待指示)</i>

    Note over AI, VCS: 4-6. 计划与执行 (Plan & Act)
    AI->>AI: /opsx:propose (生成提案)<br/><i>(AI 暂停，等待 Driver 批准 tasks.md & writing-plans)</i>
    AI->>AI: /opsx:apply (读取 tasks.md & executing-plans)<br/><i>(若执行失败，AI 重试/升级给 Driver)</i>
    AI->>AI: activate_skill meta-safe-executor (安全审计)<br/><i>(若检测到风险，AI 报告给 Driver，等待指令)</i>

    Note over AI, D: 7-9. 质量与验证 (Test & Verify)
    AI->>AI: activate_skill test-driven-development (TDD 循环)<br/><i>(遇歧义时，AI 进入“等待 Driver 问询/澄清”状态)</i>
    AI->>AI: /opsx:verify (前置守卫)<br/><i>(AI 报告验证结果，若失败则修正/升级给 Driver)</i>
    AI->>AI: activate_skill verification-before-completion (产出物证据)<br/><i>(AI 向 Driver 呈现证据摘要)</i>

    Note over AI, F: 10-13. 提纯与闭环 (Distill & Close)
    AI->>AI: activate_skill meta-distiller (资产提纯)<br/><i>(AI 暂存结果，等待 Driver 审查/Accept 提纯资产)</i>
    AI->>AI: /opsx:archive (任务归档)<br/><i>(AI 报告归档，等待 Driver 最终确认 PR/Issue 操作)</i>
    AI->>VCS: gh pr create (创建 PR)
    D->>VCS: gh pr merge (Driver 批准并合并 PR)
    AI->>VCS: gh issue close (Issue 关闭)<br/><i>(仅在 PR 合并且 Driver 确认后执行)</i>

    Note over AI: 14. 流程反馈与自我反思 (Feedback & Self-Reflection)
    AI->>AI: perform_self_reflection & update_ops_changelog<br/><i>(总结执行情况，记录挑战，为智力演进提供输入)</i>
```

> **铁律**：AI 引擎执行任务时，必须对齐此优化后的 14 步流程。任何偏离（AI 尝试跳过 Driver 审批、忽视错误升级、或未完成反思）均视为对 SOP 2.0 规约的违背。AI 必须在遇到模糊指令或流程中断时，主动寻求 Driver 的澄清或介入。

---

## 4. 角色定义 (Role Definitions)

### 4.1 实验室管理员 (Foundry Manager)

- **目标**: 维护母库（Foundry）、管理 Skills 与 Patterns。
- **自演进模式**: 当修改母库自身时，管理员身份重叠为 Workshop Developer，必须通过本地 OpenSpec 流程提交变更。

### 4.2 资产收割员 (Workshop Developer)

- **目标**: 在业务项目中引用母库智力，并识别、上报高价值逻辑。
- **核心工具**: 使用 `meta-distiller` 进行逻辑脱水。

### 4.3 AI 引擎 (SOP Engine)

- **目标**: 在规约框架内执行任务，并根据 Driver 的指令进行协作与回退。
- **强制逻辑**: 必须通过 [CRITICAL-BOOT-SEQUENCE] 完成初始化，并在 14 步生命周期内严格遵循 Driver 的审批与指导。

---

## 4. 角色定义 (Role Definitions)

### 4.1 实验室管理员 (Foundry Manager)

- **目标**：维护母库（Foundry）、管理 Skills 与 Patterns。
- **自演进模式**：当修改母库自身时，管理员身份重叠为 Workshop Developer，必须通过本地 OpenSpec 流程提交变更。

### 4.2 资产收割员 (Workshop Developer)

- **目标**：在业务项目中引用母库智力，并识别、上报高价值逻辑。
- **核心工具**：使用 `meta-distiller` 进行逻辑脱水。

### 4.3 AI 引擎 (SOP Engine)

- **目标**：在规约框架内执行任务。
- **强制逻辑**：必须通过 [CRITICAL-BOOT-SEQUENCE] 完成初始化。

---

## 5. 文档导航地图 (Documentation SSOT Map)

为了消除冗余，本项目严格遵守以下文档分工。任何重复定义均应以 `ARCHITECTURE.md` 为准。

| 文件名                 | 定位                    | 核心内容                                            |
| :--------------------- | :---------------------- | :-------------------------------------------------- |
| **README.md**          | **门面 (Entrance)**     | 项目简介、快速路由、致敬与上游依赖。                |
| **ARCHITECTURE.md**    | **真值源 (SSOT)**       | **物理架构、二元模型、生命周期流程图、角色定义。**  |
| **GETTING_STARTED.md** | **操作 (Operations)**   | 环境搭建、12 步协议、递归自演进配置、故障排除。     |
| **GEMINI.md**          | **登舰 (Onboarding)**   | **AI 启动自检清单 (Boot Sequence)**、快速指令看板。 |
| **SOP_CORE_MANUAL.md** | **哲学 (Philosophy)**   | 系统血统、逻辑刚性原则、资产提纯理论。              |
| **global_standard.md** | **宪法 (Constitution)** | 全局禁令、安全锁、审计铁律。                        |

---

## 6. 核心组件定义

### 治理层 (Governance)

- **OpenSpec**: 管理任务生命周期的“骨架”。
- **CI/CD Guardrails**: GitHub Actions 提供的物理治理强制手段。

### 智力资产层 (Assets)

- **Skills & Patterns**: 经过提纯的原子知识与代码图纸。

### 执行引擎 (Engine)

- **Meta-Safe-Executor**: 物理安全与审计层。
- **Meta-Distiller**: 资产提纯层。
- **Superpowers**: 工程技能与肌肉层。

---

_YOU-DRIVE-SOP - 驱动规约，掌握智力。_
