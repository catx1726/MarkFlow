# YOU-DRIVE-SOP 核心治理手册 (Core Manual)

> **"AI 驱动逻辑，你驱动规约。"**  
> 本手册旨在为“驾驶员（用户）”提供对 YOU-DRIVE-SOP 2.0 体系的全局透视，重点阐述如何通过物理规约锁死 AI 幻觉，并实现智力资产的自演进。

---

## 第零章：血统与哲学 —— 为什么是 YOU-DRIVE-SOP？

在 AI 爆发的时代，我们不缺代码生成器，但极度缺乏**可复用的智力资产**。

### 0.1 SOP 2.0 物理全景架构图 (The Three-Layer Architecture)

关于系统的物理架构全景、资产流转逻辑以及“骨架-肌肉”二元执行模型，请参阅唯一真值源：[**ARCHITECTURE.md (系统架构规约)**](./ARCHITECTURE.md)。

### 0.2 核心血统 (Lineage)

本框架是站在巨人肩膀上的作品，深度集成了以下核心引擎：

- **OpenSpec (Fission-AI)**：提供变更驱动的生命周期管理（治理底座）。
- **Superpowers (obra)**：提供原子化技能（Skills）与严苛的工程习惯（肌肉）。

> **智力底座规约**：关于上述引擎的底层物理逻辑，请参阅 [OpenSpec Core Mechanics](openspec/specs/upstream-lineage/openspec-core.md) 与 [Superpowers Skill Mechanics](openspec/specs/upstream-lineage/superpowers-core.md)。

### 0.2 为什么基于规约 (Why Protocols?)

1. **Prompt 的脆弱性**：自然语言指令容易随上下文长度增加而“腐烂”。**物理规约是刚性的**。
2. **逻辑与 UI 的分离**：通过 `logic_schema`，我们将智力从具体的、易变的视图中剥离，使其能够反哺母库。
3. **资产的可持续性**：代码会过时，但经过提纯的“Pattern（图纸）”是通用的。

### 0.3 极端纪律 (Extreme Discipline)

本框架继承了 Superpowers 最严苛的工程基因：

- **TDD 铁律**：严禁在有失败测试前编写任何业务代码。若 AI 违规先行编码，**必须物理删除该代码并重来**。禁止“适配”或“参考”违规代码。
- **调试铁律**：严禁在未定位根因前尝试修复。若 **3 次修复尝试** 均告失败，必须立即停止，转而向驾驶员发起“架构合理性”质疑。

---

## 第一章：逻辑刚性 —— 物理宪法如何驱动 AI

在传统的 AI 协作中，AI 的行为往往取决于“Prompt 的运气”。而在 YOU-DRIVE-SOP 体系下，AI 的每一行代码、每一个动作都被 **物理规约（Physical Protocols）** 严格限制。

### 1.1 四层治理架构 (Governance Hierarchy)

本体系通过四层逻辑隔离，确保 AI 既具备执行力，又不会脱离控制。

| 层级 | 物理载体 | 核心职能 | 约束效力 |
| :-- | :-- | :-- | :-- |
| **宪法层 (Constitution)** | `.gemini/global_standard.md` | 定义核心哲学、空间认知与全局禁令。 | **最高** (不可逾越) |
| **配置层 (Config)** | `openspec/config.yaml` | 定义项目特定的流程（Workflow）与工具链（GH CLI）。 | **中** (指导执行) |
| **协议层 (Protocols)** | `openspec/specs/*.md` | 定义具体场景的刚性标准（如资产提纯、安全审计）。 | **中** (细化标准) |
| **技能层 (Skills)** | `.gemini/skills/*/SKILL.md` | AI 的原子化操作手册，提供分步执行的物理引擎。 | **执行级** (直接驱动) |

### 1.2 物理审计锁：审计先行 (Audit-First)

AI 的每一个动作都必须在物理上“有据可查”。

- **Ops Changelog**：在执行任何文件修改前，AI 必须首先在 `.gemini/ops_changelog.md` 记录意图。
- **Git Sentinel**：修改前强制执行 Git 状态检查，确保所有的“后悔药（Undo CMD）”都是基于确定的 Git 快照。
- **逻辑隔离**：审计日志与代码分流，确保操作轨迹不会污染生产逻辑。

### 1.3 步前读回 (Step-before-read)

为了解决长任务中的“意图漂移”和“幻觉积累”，AI 被强制要求：

1. **进度存根**：在 `.gemini/skill_progress.md` 中实时维护任务状态。
2. **读回验证**：在执行长文档或代码生成的下一步前，必须显式 `read_file` 之前已完成的所有上下文，确保逻辑的一致性。

### 1.4 资产安全与隔离 (Asset Safety & Isolation)

为了确保 Foundry 资产在 Workshop 环境中的完整性和安全性，系统遵循**“安全优先”**原则：

-   **强制忽略 (Git Ignore)**：在 Workshop 初始化或同步时，确保 `.gitignore` 正确配置，以忽略不应直接包含在 Workshop Git 仓库中的 Foundry 核心资产（例如，`.gemini/skills/`, `patterns/`, `.gemini/link.json` - 即使 link.json 记录的是逻辑路径，也不应将其纳入 Workshop 版本控制）。这有助于防止 Git 意外地管理或删除这些指向母库的（现在是逻辑上的）引用，并避免潜在的冲突。
-   **防止误操作**: 强调在 Git 切换分支或执行清理命令时，需谨慎操作，防止意外丢失或损坏从母库拷贝过来的关键资产。


---

## 第二章：资产全生命周期循环 —— 智力资产的提纯与反哺

在 YOU-DRIVE-SOP 体系中，代码不仅仅是功能的实现，更是智力资产的载体。本章将揭示逻辑如何从业务代码中脱胎换骨，最终并入母库（Foundry）。

### 2.1 资产的“精炼”路径 (Distillation Path)

逻辑资产的流动遵循以下物理步骤：

1.  **识别 (Identification)**：AI 通过依赖扫描与导出映射，自动识别具备通用价值的逻辑。
2.  **暂存 (Staging)**：激活 `meta-distiller` 技能，将逻辑提取至子库的 `.gemini/distill_stage/`。
3.  **参数化 (Sanitization)**：移除所有硬编码的项目信息，替换为 `{{VAR}}` 占位符。
4.  **反哺 (Contribution)**：执行 `/opsx:archive`，将暂存资产物理合并至母库的 `patterns/`。
5.  **物理分流 (Partitioning)**：对于治理类（Governance）资产（如规约、元技能），系统强制要求将其存入 `archive/governance/` 子目录，严禁与业务审计混淆。

### 2.2 母库守门人：双重验证门禁 (Double Verification)

为了保证母库资产的 100% 可用性，系统强制执行双重物理校验：

- **子库预验**：在子库环境下，资产必须通过其配套的 `index.test.ts`。
- **母库复验**：资产并入母库后，AI 必须切换至母库环境再次执行测试。
- **原子撤回**：若母库复验失败，系统必须执行原子级回滚，严禁脏代码污染。

### 2.3 资产“三件套”准入标准 (The Triple-Standard)

为了保证母库资产的 100% 生产级可用性，系统强制执行“三位一体”物理校验：

- **`index.ts` (逻辑体)**：必须经过参数化（{{VAR}}）处理，严禁残留业务敏感词。
- **`index.test.ts` (契约证明)**：必须覆盖主要逻辑分支，且必须在母库环境下复验通过。
- **`README.md` (使用契约)**：必须明确输入输出、安装依赖与使用场景。
- **刚性门禁**：若 Staging 区缺失上述任一物理文件，AI 将被禁止执行归档动作。

### 2.4 Skill-Pattern 联动机制

本体系实现了“知行合一”的物理链路：

- **Skill (大脑)**：在 `.gemini/skills/` 中定义“何时用”与“为什么用”。
- **Pattern (肌肉)**：在 `patterns/` 中提供具体的实现代码。
- **物理引用**：Skill 文档中必须包含指向对应 Pattern 物理路径的 Markdown 链接。

---

## 第三章：驾驶员协议与自演进 —— 人机协作的边界与进化

YOU-DRIVE-SOP 不是一个全自动的黑盒，而是一个由人类“驾驶”的精密引擎。本章定义了驾驶员（Operator）与 AI（Engine）的协作协议，以及系统如何实现自演进。

### 3.1 驾驶员 (Operator) 的控制权

驾驶员拥有对系统方向的绝对决策权和物理变更的审批权：

- **方案决策 (Decision)**：AI 在执行任何复杂设计前，必须通过 `brainstorming` 提交方案并获得驾驶员批准。
- **破坏性熔断 (Safety Gate)**：针对 `DELETE`、`MOVE` 或 `Clear-Content` 等物理动作，AI 必须强制触发确认弹窗。
- **资产准入 (Acceptance)**：资产进入母库前的最后一步，由驾驶员根据“提纯自检表”执行物理 Accept。

### 3.2 AI (Engine) 的执行权

AI 负责在规约框架内实现任务的物理自动化：

- **自治搜索 (Global Search)**：在编写新代码前，AI 必须主动检索母库 `patterns/` 资产。
- **物理诚实 (Integrity)**：AI 禁止生成“示例代码”，所有产出必须是真实可运行、具备测试覆盖的物理文件。
- **审计留痕 (Traceability)**：AI 负责自动记录所有的操作日志与任务进度，确保过程透明。

### 3.3 架构决策 (ADR) 与系统自演进

YOU-DRIVE-SOP 的核心竞争力在于其**自演进能力**：

- **ADR 驱动**：每一次非平庸的纠偏、架构选择或流程调整，都必须记录在 `openspec/decisions/`。
- **经验资产化**：通过 `meta-distiller`，不仅提纯代码逻辑，更将“如何解决特定问题”的方法论固化为 Skill。
- **母库演进**：通过 PR 机制将各子库的优秀实践合并至母库，实现智力库的动态膨胀。

---

## 第四章：AI 登舰协议 —— 让 AI 瞬间“掌握”本项目

为了让任何新进入本项目的 AI (如 Gemini, Claude, Cursor) 能够立即对齐规约，请遵循以下流程：

### 4.1 核心握手：读取物理看板

每一个进入本项目的 AI 必须被告知首选读取 `GEMINI.md` 或 `AGENTS.md`。

- **快速操作看板**：该看板列出了当前子库已对齐的指令与技能。
- **规约探测指令**：用户可以对 AI 说：『请读取 `SOP_CORE_MANUAL.md` 并执行物理健康自检报告。』

### 4.2 AI 自检清单 (AI Self-Check)

当 AI 准备开始任务前，它应该在内部执行以下清单：

1. **Spatial Awareness**：我在母库 (Foundry) 还是子库 (Workshop)？
2. **Constitutional Alignment**：我是否已读取 `.gemini/global_standard.md`？
3. **Audit Readiness**：我是否已定位 `.gemini/ops_changelog.md` 并准备好记录动作？

### 4.3 智力继承模型 (Inheritance Model)

本体系通过物理分层实现高效的规约对齐：

- **母库端 (Foundry)**：通过 `foundry-initializing` 执行“源码级对齐”，深度阅读 `tools/` 下的上游引擎源码。
- **子库端 (Workshop)**：通过 `workshop-initializing` 执行“契约级对齐”，强制读取母库的 `SOP_CORE_MANUAL.md`。
- **价值**：确保了规约的单点维护与全链路同步。

### 4.4 链路回退与自举模式 (Link Fallback)

由于环境或权限限制，物理链路可能存在两种状态：

- **Linked (实时同步)**：基于物理 Junction。母库的每一次 Skills/Patterns 更新都会瞬间反映在子库。
- **Copied (静态副本)**：由于权限不足回退至全量复制。必须通过 `workshop-sync` 技能手动拉取母库更新。
- **物理自举**：新子库在感知技能前，必须执行 `gemini skills link` 的“开门指令”，这是 12.5 步生产协议的物理起点。

---

## 结语：迈向自主演进的智力实验室

YOU-DRIVE-SOP 将传统的“交付式开发”转变为“资产驱动式演进”。

- **不再是写代码，而是在打磨图纸。**
- **不再是解 Bug，而是在修复规约。**

作为驾驶员，您的每一次决策都在完善这套 SOP。欢迎来到这个自主演进的智力世界。

---

_全书完。_
