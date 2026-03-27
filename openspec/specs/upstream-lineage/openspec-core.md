# OpenSpec Engine Core Mechanics

> **"Lineage Alignment: Derived from tools/OpenSpec/src/core/ (v1.2.0)"**  
> 本规约记录了上游 OpenSpec 引擎的底层物理逻辑，旨在消除智力黑盒并指导母库的 SOP 演进。

---

## 1. 工件依赖引擎 (The Math Engine)

### 1.1 拓扑排序算法 (Kahn's Algorithm)
OpenSpec 采用 **卡恩算法 (Kahn's Algorithm)** 计算工件的构建顺序。
- **物理证据**：`graph.ts` -> `getBuildOrder()`。
- **行为特性**：排序结果具有物理确定性。在处理同级（入度为 0）节点时，系统显式执行 `.sort()` 排序。

### 1.2 Schema 查找优先级
系统按以下物理路径降序搜索 Schema 定义：
1. **最高优先**：`<projectRoot>/openspec/schemas/` (本地覆盖)。
2. **中优先**：`${XDG_DATA_HOME}/openspec/schemas/` (用户全局)。
3. **最低优先**：npm 包内置的 default schemas。

---

## 2. 规约织入逻辑 (The Weaving Engine)

### 2.1 变更处理原子性
在执行 `/opsx:apply` 时，系统遵循严格的“全有或全无”原则。
- **冲突检测**：禁止在同一个 Delta Spec 中对同一项 Requirement 同时执行 ADDED 与 REMOVED。
- **物理顺序**：内部执行逻辑固定为：`RENAMED` -> `REMOVED` -> `MODIFIED` -> `ADDED`。

### 2.2 格式刚性 (#### Standard)
- **Scenarios 约束**：所有场景描述必须使用**恰好 4 个井号 (`####`)**。
- **后果**：使用 3 个或 5 个井号会导致 Parser 静默忽略该场景，归档时无法正确织入主 Spec。

### 2.3 物理技能绑定 (Physical Skill Binding)
OpenSpec 的 `/opsx:*` 指令集与其配套的 Skill 目录存在硬性物理映射。
- **物理证据**：`init.ts` -> `WORKFLOW_TO_SKILL_DIR`。
- **映射示例**：`/opsx:propose` -> `openspec-propose`；`/opsx:archive` -> `openspec-archive-change`。
- **规约推论**：技能目录名称 **SHALL** 保持绝对一致性。任何对技能目录的重命名或二级嵌套都会直接导致 CLI 指令失效。

### 2.4 任务模板注入 (Task Template Injection)
系统支持在 `openspec/config.yaml` 中定义 `templates: tasks` 来预置任务清单。
- **物理证据**：`artifact-graph/instruction-loader.ts`。
- **行为特性**：生成的 `tasks.md` 会优先加载该模板内容，并将其作为 AI 执行的基础 Checklist。
- **规约推论**：利用该机制，本框架实现了“任务 0：规约自检”的物理防呆（Mandatory Setup）。

---

## 3. 故障排查与鲁棒性指引

### 3.1 Windows 权限冲突 (EPERM)
- **现象**：归档时报错 `EPERM`（通常由 IDE 或杀毒软件锁定导致）。
- **机制**：源码 `archive.ts` 实现了 `Copy-then-Remove` 的稳健回退逻辑。
- **建议**：若遇到物理删除失败，AI 应引导用户手动检查文件占用。

### 3.2 归档门禁冲突 (Soft Gate)
- **现象**：存在 `[ ]` 未勾选的任务。
- **处理**：系统会物理阻塞归档流程，除非使用 `--yes` 强行覆盖。
- **规约**：AI 禁止在任务未标记完成时尝试执行归档。

---
*Created on 2026-03-13 by YOU-DRIVE-SOP Engine.*
