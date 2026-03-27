# Superpowers Skill System Mechanics

> **"Lineage Alignment: Derived from tools/superpowers/ (v5.0.0)"**  
> 本规约记录了上游 Superpowers 技能系统的底层物理逻辑，旨在通过强制性工程纪律提升 AI 的协作浓度。

---

## 1. 技能加载与触发 (The Bootloader)

### 1.1 会话级强制注入 (SessionStart Hook)
Superpowers 采用“开机即握手”的注入机制。
- **物理证据**：`hooks/session-start` (Bash)。
- **行为特性**：在会话启动瞬间，强制将 `using-superpowers` 全量内容包裹在 `EXTREMELY_IMPORTANT` 标签中注入上下文头部。
- **后果**：AI 拥有了不可磨灭的“技能意识”，而非被动响应。

### 1.2 指令集的“幽灵化” (Deprecation)
- **现状**：`/brainstorm` 等传统 Slash Commands 已在源码中显式声明为 **Deprecated**。
- **规约**：推荐完全通过 `skills` 驱动（如 `superpowers:brainstorming`），而非依赖短命令。

---

## 2. 工程纪律铁律 (The Iron Laws)

### 2.1 TDD 的物理删除约束
- **核心逻辑**：如果 AI 在创建失败测试前编写了任何生产代码，**必须执行物理删除**。
- **刚性要求**：严禁保留违规代码作为参考或适配。删除必须彻底，重来必须清空。

### 2.2 系统化调试的 4 阶段模型
1. **Phase 1: Root Cause Investigation** (禁止猜测，强制诊断埋点)。
2. **Phase 2: Pattern Analysis** (对比工作示例)。
3. **Phase 3: Hypothesis Testing** (单一变量验证)。
4. **Phase 4: Implementation** (修复根因，而非症状)。

### 2.3 架构质疑门禁 (3-Fail Rule)
- **触发条件**：同一故障经过 3 次修复尝试均告失败。
- **强制行为**：AI 必须停止所有物理修复动作，主动向驾驶员发起“底层架构合理性”质疑。

### 2.4 证据先行原则 (Evidence Before Claims)
Superpowers 建立了“不验证即欺骗”的物理诚信标准。
- **核心逻辑**：AI 严禁在没有当前会话物理运行结果的情况下宣布“任务完成”或“测试通过”。
- **物理证据**：`verification-before-completion/SKILL.md`。
- **证据链 (Evidence Chain)**：完整的验证必须包含：
  1. 运行的 **物理指令**。
  2. 指令生成的 **完整/关键输出**。
  3. 指令的 **退出码 (Exit Code)**。
- **规约推论**：任何带有“应该、可能、看起来”等模糊辞藻的完成申明均视为 **SOP Breach**。

---
*Created on 2026-03-13 by YOU-DRIVE-SOP Engine.*
