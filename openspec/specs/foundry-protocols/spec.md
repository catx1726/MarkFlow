## ADDED Requirements

### Requirement: 执行流标准化 (12-Step Protocol)
所有 AI 任务的实施 SHALL 严格遵循 [**GETTING_STARTED.md**](../../GETTING_STARTED.md#🚦-生产生命周期-the-12-step-protocol) 中定义的 12 步工业级协议。
- **强制拓扑**：必须按照 Propose -> Apply -> Distill -> Archive 的顺序执行物理动作。
- **自检门禁**：任务实施前必须勾选“Mandatory Setup”中的自检项。

#### Scenario: 12 步协议执行
- **WHEN** AI 开始执行任何 Apply 动作
- **THEN** 必须首先通读任务清单中的 Setup 章节并报告其物理对齐结果。

### Requirement: 环境指纹识别 (workshop-initializing)
子库对齐 SHALL 包含链路持久化、规约同步与高可见性的交互引导。
- **物理链路**：必须在子库创建 `.gemini/link.json` 记录母库绝对路径。
- **规约同步**：必须将母库的 `openspec/schemas/` 核心协议注入子库本地。
- **看板注入**：初始化生成的 `GEMINI.md` 必须包含「🚀 快速操作看板」，涵盖核心治理（OpenSpec）与执行（Superpowers）指令。
- **意图引导**：初始化流程末尾必须包含一个交互式询问点，根据用户选择（如：逆向或开发）自动进入下一步逻辑。

#### Scenario: 看板辅助驱动
- **WHEN** 用户在子库启动 Gemini CLI。
- **THEN** AI 自动读取 `GEMINI.md` 看板，并在欢迎语中列出：`/opsx:propose`, `legacy-extractor`, `meta-rollback` 等常用指令。

#### Scenario: 初始化的“新手村”引导
- **WHEN** `workshop-initializing` 执行完毕。
- **THEN** AI 暂停并提问：『您现在是想扫描旧项目（输入 A）还是开发新功能（输入 B）？』，并根据响应展示第一条指令的操作细节。

### Requirement: 全谱系智力对齐 (Full Intelligence Alignment)
子库与母库的同步或初始化动作 SHALL 遵循全谱系对齐原则，严禁产生“逻辑代沟”。
- **大脑对齐**：必须同步 `.gemini/skills/` 全量原子技能。
- **肌肉对齐**：必须同步 `patterns/` 全量代码图纸。
- **灵魂对齐 (核心)**：必须同步 `openspec/specs/` 与 `openspec/schemas/` 治理全集。
- **宪法对齐**：必须同步根目录下所有的宪法类文件（`global_standard.md`, `AGENTS.md`, `GETTING_STARTED.md`）。

#### Scenario: 增量拉取闭环
- **WHEN** 执行 `activate_skill workshop-sync`
- **THEN** 系统自动扫描母库全谱系资产，并以增量方式（/D）补全子库缺失或陈旧的所有智力组件。

### Requirement: 逻辑提纯协议 (logic_schema)
逻辑提纯 SHALL 具备全局唯一入口并包含强制性的双重验证（Double Verification）流程。
- **唯一执行引擎**：母库体系内所有的资产收割、逻辑提炼动作必须由 `meta-distiller` 技能统一执行。
- **物理标准**：存入 `patterns/` 的每个资产必须包含 `index.ts`, `index.test.ts`, `README.md`。
- **本地预验**：在提纯至 Staging 阶段，必须在当前 Workshop 环境下通过所有配套测试。
- **母库复验**：在并入母库（Accept）阶段，必须在母库环境下再次通过测试。
- **零污染契约**：母库 `patterns/` 的唯一写入条件是复验通过。若复验失败，系统必须执行原子级回退，严禁保留未验证的代码片段。
- **参数化**：所有项目特定词汇必须根据 `env.md` 替换为 `{{VAR_NAME}}`。
- **丰满度标准**：生成的文档必须详实，涵盖 Spec 定义的所有功能点。

#### Scenario: 严苛的入库考试
- **WHEN** 执行资产入库动作。
- **THEN** AI 自动执行物理迁移 -> 母库环境测试。若测试失败（如：发现由于 Node 20 版本导致的 API 不兼容），AI 必须报告：『复验失败：[错误详情]。正在撤回入库动作...』，并将资产恢复至子库 Staging 区。

#### Scenario: 从旧项目逆向收割
- **WHEN** AI 使用 `legacy-extractor` 识别出一段高价值业务代码。
- **THEN** AI 禁止在本地 `logic.md` 中展开代码，而是引导用户激活 `meta-distiller` 将该资产反哺至母库。

### Requirement: 母库初始化 (foundry-initializing)
母库初始化 SHALL 具备全量规约继承能力并保持物理极简。
- **模板注入**：初始化不再创建空文件，必须同步注入框架内置的 `Global Standard` 与 `Schemas` 模板内容。
- **物理去冗余**：技能目录必须保持扁平，禁止在 `skills/` 下创建 `meta/`、`common/` 等嵌套物理目录。
- **成功反馈**：初始化完成后，必须提供包含工具链状态与规约摘要的总结报告。

#### Scenario: 即插即用的母库建立
- **WHEN** 用户执行 `foundry-initializing`。
- **THEN** 系统在创建目录的同时，自动填充打磨好的核心协议文件，使用户无需手动配置即可开始资产沉淀。

### Requirement: 生产安全审计 (Production Safety Audit)
系统 SHALL 对所有物理写操作执行实时审计与熔断保护。
- **操作日志**：子库必须维护 `.gemini/ops_changelog.md` 记录每次操作的时间、意图及撤销指令。
- **编码刚性 (UTF-8)**：所有日志写入必须强制使用 **UTF-8 (无 BOM)** 编码。
- **Windows 执行规约**：在 Windows 环境下，AI 严禁使用 `echo >>` 等可能导致 `UTF-16LE` 编码的重定向指令写入日志。必须优先使用 `write_file` 工具或显式指定 `-Encoding UTF8` 的 PowerShell 指令。
- **安全熔断**：破坏性操作（DELETE, MOVE）必须强制弹窗确认。
- **Git 快照**：写操作前必须确保当前状态已 Commit。

#### Scenario: 误删恢复
- **WHEN** AI 执行了错误的删除指令。
- **THEN** 用户通过读取 `ops_changelog.md` 中的撤销指令或 Commit ID，能够瞬间回滚。

### Requirement: 归档门禁 (openspec-changes-archive)
归档流程 SHALL 执行管理档案与执行记录的物理镜像分流存储。
- **镜像结构**：
    - **管理档案**：`openspec/changes/archive/[governance/]<YYYY-MM-DD-name>/`
    - **操作审计**：`openspec/operations/archive/<YYYY-MM-DD-name>/ops_changelog.md`
- **治理判定 (Governance)**：凡涉及全局规约、元技能重构、工具链升级或架构决策的任务，必须归档至 `governance/` 子目录。
- **分流强制性**：归档动作执行时，AI 必须校验任务属性。若判定为治理类变更而未指定 `governance/` 路径，系统必须物理阻塞并提示纠偏。
- **日志增量性**：在任务周期内，`.gemini/ops_changelog.md` 必须保持物理增量，严禁在未备份前执行全量覆盖。
- **PR 自动化**：归档流程必须生成符合 GitHub 标准的 PR Summary 文档。

#### Scenario: 治理类资产的强制分流
- **WHEN** 执行 `/opsx:archive` 归档一个涉及 `global_standard.md` 修改的任务。
- **THEN** AI 自动识别其治理属性，强制将任务文件夹移入 `openspec/changes/archive/governance/` 目录，并同步输出 PR Summary 与资产反哺报告。

### Requirement: 链接自愈协议 (Link Self-Healing)
系统 SHALL 能够自动识别并修复子库中失效的技能映射，并强制执行物理隔离。
- **属性识别**：必须能够通过 `ReparsePoint` 属性识别物理联接点（Junction）。
- **幂等清理**：在重建链接前，SHALL 安全移除现有的联接点，同时严格保护 non-linked 的本地文件夹（如 `openspec-bridge`）。
- **物理重建**：使用 `Junction` 类型重建从子库到母库技能的一对一映射。
- **Git 物理隔离 (Critical Safety)**：系统在建立物理链路**前**，必须强制在子库的 `.gitignore` 中包含 `.gemini/skills/`、`patterns/` 与 `link.json`。
- **穿透防护**：禁止 AI 在未验证 Git 隔离状态的情况下执行物理链接动作。

#### Scenario: 物理隔离自动注入
- **WHEN** 执行物理链路挂载。
- **THEN** AI 自动扫描并更新子库的 `.gitignore`，确保链路目录处于被忽略状态。


#### Scenario: 一键修复损坏的链接
- **WHEN** 用户发出“修复链接”或“刷新技能”指令。
- **THEN** AI 识别当前工作区所有属性为 `ReparsePoint` 的子文件夹，执行安全清理，并根据 `link.json` 定义的母库路径重建所有技能的 Junction 映射。

### Requirement: 分步执行协议 (Step-by-Step Execution)
分步执行 SHALL 包含滚动式上下文聚合机制以保证产出质量。
- **任务规划**：在开始前，必须生成一份临时任务列表。
- **状态持久化**：必须在 `.gemini/skill_progress.md` 中实时记录完成状态。
- **步前读回**：在执行任何涉及文档、规约、代码资产生成的任务步前，AI 必须显式执行 `read_file` 以读取当前已生成的全量内容。
- **终期审计步**：复杂技能的任务列表末尾必须包含一个“终期质量审计”任务，负责全局逻辑梳理与文字丰满。

#### Scenario: 长文档生成的质量保鲜
- **WHEN** AI 执行到长文档生成技能的第 3 步（如：编写 Implementation 章节）。
- **THEN** AI 必须先读取已完成的 Step 1 & 2 的文字内容，确保 Step 3 的术语与前文保持一致。

### Requirement: 品牌与脱敏 (Rebranding & Sanitization)
所有文档与代码 SHALL 遵循 `YOU-DRIVE-SOP` 品牌标准并执行脱敏。
- **禁止硬编码**：禁止出现任何特定于开发者的物理绝对路径（如 `D:\`）。
- **去组织化**：移除个人或组织特定标识，统一替换为 “Foundry”、“Workshop” 或 “Core Library”。
- **术语一致性**：资产处理动作必须使用 “Distillation”（提纯）与 “Contribution”（反哺）。

#### Scenario: 开源化文档生成
- **WHEN** AI 生成 README。
- **THEN** 系统自动使用 `YOU-DRIVE-SOP` 品牌头，并以“驾驶者（You）”为中心进行叙述。

### Requirement: 路径自动探测 (Path Discovery)
系统 SHALL 具备自动定位资源根目录的能力。
- **动态占位符**：所有的 Skill 引用必须使用 `{{FOUNDRY_ROOT}}` 占位符。
- **探测逻辑**：AI 必须首先执行根目录探测逻辑（如向上递归寻找 .gemini/global_standard.md），获取物理路径并实时填充占位符。

#### Scenario: 跨环境执行
- **WHEN** 在一个新的 Linux 环境下部署本库。
- **THEN** AI 自动识别出当前的母库根目录，无需用户修改 Skill 源码。

### Requirement: 技能文档规约 (writing-skills)
技能编写 SHALL 追求高浓度、严逻辑与全视角。
- **结构化强制**：复杂技能必须包含：
    - **Boundaries (边界)**：明确说明该技能“不解决什么”以及“执行前置条件”。
    - **The Stance (姿态)**：定义 AI 执行时的思维模式（如：严谨的审计员、好奇的探索者）。
    - **Step-by-Step Workflow**：带有进度存根的任务列表。
    - **Patterns & Anti-Patterns**：提供具体的正反面案例对比。
    - **Final Audit**：定义产物自检项。
- **分步生成**：技能的创建与重构必须遵循“步进增长”模式，每章节需经人工审核逻辑。

### Requirement: 文档亲和力 (Documentation Affinity)
操作手册 SHALL 具备场景感知能力。
- **路径分流**：README 必须清晰划分“Legacy (旧项目)”与“Feature (新功能)”两条核心操作链路。
- **指令可视化**：手册中必须展示完整的指令链示例（Instruction Chains）。

### Requirement: 源码至图纸完整性 (Source-to-Pattern Integrity)
所有从 Workshop 提纯并入 Foundry 的资产 SHALL 遵循严格的物理闭环标准。
- **三位一体标准**：入库资产必须同时包含 `index.ts` (逻辑)、`index.test.ts` (证明) 与 `README.md` (契约)。
- **参数化强制性**：禁止保留任何特定于子库的业务敏感词。
- **关联 Skill**：母库必须同步生成或更新对应的 Skill 文档，并在 `Implementation` 章节物理引用 Pattern 路径。

#### Scenario: 资产入库的质量门禁
- **WHEN** AI 尝试执行 `/opsx:archive` 但暂存区缺失测试文件。
- **THEN** 系统必须物理阻塞并提示：『资产提纯不完整：缺失 index.test.ts。请先补全测试后再执行归档。』
