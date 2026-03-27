# YOU-DRIVE-SOP 智力演进实验室 🚀

> **"Welcome, Engine. You are now operating under the YOU-DRIVE-SOP 2.0 Protocol."**

---

## 快速引导 (Fast Onboarding)

如果您是第一次进入本工作区，请根据您的身份执行初始化动作。关于各角色的详细职责，请参阅 [**ARCHITECTURE.md#5-角色定义**](./ARCHITECTURE.md#5-角色定义)。

- **实验室管理员 (Foundry Manager)**：输入 `activate_skill foundry-initializing` 补全所有核心规约。
- **资产收割员 (Workshop Developer)**：输入 `activate_skill workshop-initializing` 来初始化 Workshop 环境。此过程将通过文件拷贝机制将母库核心资产复制到本地工作区，以规避环境限制。
- **AI 引擎 (SOP Engine)**：请立即执行下方的 **[CRITICAL-BOOT-SEQUENCE]**。

---

## [CRITICAL-BOOT-SEQUENCE] AI 登舰自检清单

**当你（AI）开启会话时，必须强制执行：**

1. **[MANDATORY-READ-SEQUENCE]**:
   - 1. READ Tier-1 (宪法): `read_file .gemini/global_standard.md`
   - 2. READ Tier-2 (架构真值源): `read_file ARCHITECTURE.md`
   - 3. READ Tier-3 (运行配置): `read_file openspec/config.yaml` && `read_file .gemini/commands/opsx/*.toml`
2. **架构感知**：检测 `.gemini/global_standard.md`。
   - **汇报**：『✓ 已识别当前工作区角色为 [Foundry/Workshop]。』
3. **状态检查**：若环境缺失核心规约，立即提示用户执行初始化。
4. **分支校验**：确认当前处于 Issue 分支而非 `main`。
5. **审计对齐**：定位 `.gemini/ops_changelog.md` 并准备记录。

### 1. 基础映射 (Basic Mapping)

- [ ] 我是否已确认当前角色 (Foundry/Workshop)？
- [ ] 我是否已确认当前处于 Issue 分支而非 `main`？
- [ ] 我是否已阅读 `ARCHITECTURE.md` 建立“骨架-肌肉”模型？
- [ ] 我是否已定位母库 (Foundry) 的 `patterns/` 目录？
- [ ] 我是否已准备好通过 `meta-safe-executor` 执行写操作？

---

## 快速操作看板 (Rapid Action Dashboard)

作为 AI 引擎，你必须严格遵循 [**13 步生产协议**](./ARCHITECTURE.md#33-微观流程13-步生产生命周期-the-13-step-protocol)。

### 1. 治理与生命周期 (OpenSpec)

- **发起提案**：使用 `/opsx:propose <name>` 启动任务生命周期。
- **验证门控**：执行 `/opsx:verify` (含 TDD 前置校验)。
- **任务归档**：使用 `/opsx:archive` 执行资产反哺与归档。

### 2. 核心原子技能 (Skills)

- **资产提纯**：`activate_skill meta-distiller` —— 将逻辑从代码中剥离。
- **智力同步**：`activate_skill workshop-sync` —— **[Copied 模式专用]** 拉取母库最新更新。
- **物理安全**：`activate_skill meta-safe-executor` —— 写操作前的 Git 快照与审计。
- **系统调试**：`activate_skill systematic-debugging` —— 基于规约的根因分析。

### 3. 健康自检报告

- **指令**：『请根据 `SOP_CORE_MANUAL.md` 的规范，执行母库物理健康自检报告。』

---

## 核心文档索引 (Governance Index)

为了防止幻觉，请务必建立以下物理文件的映射：

1.  **宪法 (`.gemini/global_standard.md`)**：定义了你的行为边界与“审计先行”禁令。
2.  **核心手册 (`SOP_CORE_MANUAL.md`)**：详细阐述了本系统的逻辑刚性、资产循环与人机协议。
3.  **底座规约 (`openspec/specs/upstream-lineage/`)**：
    - [OpenSpec Engine Core](openspec/specs/upstream-lineage/openspec-core.md)
    - [Superpowers Skill Mechanics](openspec/specs/upstream-lineage/superpowers-core.md)
4.  **配置库 (`openspec/config.yaml`)**：定义了当前项目的自动化规则与工具链绑定。
5.  **审计日志 (`.gemini/ops_changelog.md`)**：你必须实时记录动作的物理轨迹。

---

## 状态查询指令

您可以随时输入以下内容来确认流程进度：

- 『**目前的初始化状态如何？**』 —— AI 将检查链路、宪法与协议的完整性。
- 『**我接下来该做什么？**』 —— AI 将根据 `ops_changelog.md` 和 `tasks.md` 给出下一步建议。

---

_YOU-DRIVE-SOP - 驱动规约，掌握智力。_
