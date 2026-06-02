---
name: meta-runtime-evaluator
description: Use when Layer 2 verification (test commands) has passed but runtime behavior, requirement satisfaction, or subjective quality criteria need independent evaluation by a separate agent context.
---

# Meta Runtime Evaluator (Layer 3 Verification)

## Overview

本技能是三层验证架构的 **Layer 3** 组件。

在 Generator 完成计算型验证（Layer 2：`verification-before-completion` 的
IDENTIFY→RUN→READ）之后，由**独立的 Evaluator** 对运行时行为、需求满足度
进行推理型验证，消除 Generator 的自我评估偏误（Self-Evaluation Bias）。

> **核心原则：Generator ≠ Evaluator**。执行验证的 Agent 必须与生成代码的
> Agent 架构分离（不同会话/上下文）。共享上下文会重新引入试图消除的偏误。

---

## When to Use

**触发条件（满足任一即触发）：**

- [ ] 任务涉及用户可见行为变更（UI、API 响应格式、CLI 输出）
- [ ] 任务无自动化测试覆盖（遗留代码、探索性实现）
- [ ] 任务验收标准包含主观判断（"用户体验流畅"、"设计符合规范"）
- [ ] 任务被标记为 high-risk（security、payment、auth、data integrity）
- [ ] Layer 2 验证通过，但 Generator 对质量有疑虑

**不触发的场景：**

- 纯文档修改（Markdown、README）→ Layer 2 足够
- 仅配置变更且已有自动化测试覆盖 → Layer 2 足够
- 单行 Bug 修复且有回归测试 → Layer 2 足够

---

## Core Pattern: The Evaluator Loop

```text
Generator (Layer 2) ──handoff──> Evaluator (Layer 3) ──report──> Generator
        │                                │
        │  1. 运行测试命令                │  1. 阅读 Sprint Contract
        │  2. 收集客观输出                │  2. 执行运行时验证
        │  3. 生成 handoff 文件           │  3. 收集证据
        │                                │  4. 输出 verdict
        │                                │
        └── 5. 根据 verdict 修复或继续 ────┘
```

---

## Handoff Protocol (Generator → Evaluator)

Generator 完成 Layer 2 后，必须生成标准化的 handoff 文件。

### 文件位置

```
docs/superpowers/evaluator-handoffs/<task-id>-<timestamp>.md
```

### 文件格式

```markdown
---
evaluator_input:
  task_id: "issue-N"
  task_description: "简要描述任务目标"
  plan_reference: "docs/superpowers/plans/issue-N.md"
  spec_reference: "docs/superpowers/specs/issue-N.md"
  generator_claims:
    - "声明 1：实现了 X 功能"
    - "声明 2：修复了 Y Bug"
  layer2_results:
    command: "npm test"
    exit_code: 0
    summary: "34/34 pass, coverage 87%"
  changed_files:
    - path: "src/auth.ts"
      description: "登录逻辑"
    - path: "src/auth.test.ts"
      description: "对应测试"
  verification_commands:
    - "npm run dev"        # 启动服务
    - "npm run test:e2e"   # 端到端测试
  sprint_contract:
    - "用户可通过邮箱密码登录"
    - "登录成功后返回 JWT 令牌"
    - "令牌过期后自动刷新"
---

## 补充上下文

<!-- Generator 在此处补充任何 Evaluator 需要但 handoff 中未包含的信息 -->
```

---

## Evaluator Workflow

Evaluator 收到 handoff 后，按以下流程执行：

### Step 1: 阅读 Sprint Contract

- 提取明确的、可验证的验收标准
- 标记模糊标准（"流畅"、"美观"）→ 在报告中标注为 subjective

### Step 2: 准备环境

- 根据 `verification_commands` 启动被测服务
- 确认服务可达（health check / 首页加载）

### Step 3: 执行验证

- 按 Sprint Contract 逐项验证
- 使用项目已配置的测试工具（Playwright / Cypress / curl / CLI）
- **不读代码**，只"使用产品"

### Step 4: 收集证据

- 截图 → `evaluator-evidence/<task-id>/<scenario>.png`
- 命令输出 → `evaluator-evidence/<task-id>/<command>.log`
- 网络日志（如适用）→ `evaluator-evidence/<task-id>/network.log`

### Step 5: 输出报告

---

## Evaluator Report Format

```markdown
## 运行时验证报告

### Sprint Contract 检查
| 标准 | 状态 | 证据 |
|------|------|------|
| 标准 1 | ✅ PASS | 截图路径或命令输出 |
| 标准 2 | ❌ FAIL | 具体失败描述 + 证据 |

### 独立验证
| 检查项 | 命令 | 结果 |
|--------|------|------|
| e2e 测试 | `npm run test:e2e` | 5/5 pass |

### 总体评估
- **verdict**: PASS / FAIL / PARTIAL
- **confidence**: HIGH / MEDIUM / LOW
- **blocking_issues**: N
- **note**: 补充说明
```

### Verdict 定义

| verdict | 含义 | 后续行动 |
|---------|------|---------|
| **PASS** | 所有 Sprint Contract 满足 | Generator 继续下一步 |
| **FAIL** | 至少一个 blocking 标准未满足 | Generator 修复 → 重新提交 Layer 3 |
| **PARTIAL** | 核心功能满足，有 minor 问题 | Generator 决定修复或记录为 technical debt |

---

## Integration with Existing Skills

| 技能 | 关系 | 说明 |
|------|------|------|
| `verification-before-completion` | **前置依赖** | Layer 2 完成后才能触发 Layer 3 |
| `requesting-code-review` | **互补** | code-review 覆盖静态代码质量，本 skill 覆盖动态运行时行为 |
| `meta-safe-executor` | **触发点** | 在审计日志中增加"是否需要 Layer 3"判断 |

---

## Red Flags

**Generator 侧：**

- 未运行 Layer 2 直接提交 Layer 3 → 拒绝，要求先执行测试命令
- handoff 中缺少 Sprint Contract → 拒绝，要求明确验收标准
- 试图在 handoff 中"说服" Evaluator（"这段代码应该没问题"）→ 删除主观描述

**Evaluator 侧：**

- 读了代码而不是"使用产品" → 违反核心原则
- 与 Generator 共享上下文 → 违反核心原则
- 未收集证据就输出 verdict → 违反核心原则
- 对 subjective 标准给出绝对判断 → 标注 confidence 为 LOW

---


