---
handoff_id: generator-evaluator-research-2026-05-28
author: AI Assistant
created: 2026-05-28
status: active
parent_handoff: harness-engineering-research-2026-05-27
research_question:
  - verification-before-completion 如何升级为 sub-agent 模式
  - 为什么 superpowers upstream 没有将其做成 sub-agent 模式
dependencies:
  - docs/superpowers/handoffs/harness-engineering-research-2026-05-27.md
  - docs/superpowers/lifecycle.md
sources:
  - obra/superpowers (upstream)
  - OpenAI Harness Engineering (2026-02)
  - Anthropic Harness Design for Long-Running Apps (2026-03)
  - Martin Fowler / Addy Osmani / Cognition 行业综述
---

# Generator/Evaluator 分离深度调研 —— verification-before-completion 升级分析

## 0. 前置说明

**无法获取 VSCODE KIMI CODE Assist sessionId
`da668290-8226-4c4b-bf2e-60f73c79a71e` 的内容。**
本调研基于项目现有 handoff 文档、commit 记录、superpowers upstream 原始文档及
Harness Engineering 公开资料进行推理分析。

---

## 1. 核心问题拆解

| 问题 | 本质 |
|------|------|
| **如何升级** | 将同一会话内的自我约束（Gate Function）改造为架构分离的 Evaluator subagent |
| **为什么 superpowers 没做** | 框架定位、成本门槛、环境隔离难题、渐进式演进策略的综合结果 |

---

## 2. Harness Engineering 底层认知：为什么需要分离

### 2.1 Self-Evaluation Bias（自我评估偏误）

这是 LLM 的**结构性属性**，不是 bug，不会随着模型升级而消失：

> "When asked to evaluate work they have produced, agents tend to respond by
> confidently praising the work, even when, to a human observer, the quality is
> obviously mediocre." — Rajasekaran, OpenAI

Anthropic 的实验数据（2D 复古游戏引擎）：

| 模式 | 成本 | 时间 | 结果 |
|------|------|------|------|
| Solo Agent | $9 | 20min | 技术上能启动，但核心功能损坏 |
| Planner+Generator+Evaluator | $200 | 6h | 完全可玩，含 AI 关卡生成、精灵动画、音效 |

**关键发现**：成本约 20 倍，但输出从"不可用"变为"可用"。
这就是 Harness Engineering 的核心交易：**用结构性开销换取可靠性**。

### 2.2 GAN 式对抗原理

Generator/Evaluator 分离借鉴自生成对抗网络（GAN）：

- **Generator** 负责生成输出
- **Evaluator** 负责独立评判
- **对抗张力**迫使质量提升

> "The key principle: the Evaluator must be architecturally separate from the
> Generator — shared context reintroduces the same bias you're trying to
> eliminate." — Milvus/O'Reilly 综述

### 2.3 三层评审模型

行业中存在三种评审模式，成本和效果递增：

| 模式 | 做法 | 优点 | 局限 |
|------|------|------|------|
| **Self-Evaluation** | 同一会话，生成后自评 | 零成本 | 生成过程的"合理化偏见"留在上下文里，评估时会被自己说服 |
| **Different-Instance** | 不同会话的同模型，不共享上下文 | 无生成偏见 | 同模型的共同盲点仍在 |
| **Cross-Model** | Claude 写，GPT-4 评；或 Sonnet 写，Haiku 评 | 盲点不重叠，标准差异大 | 成本翻倍，工程复杂度上升 |

Anthropic 官方立场：
> "Single-model self-evaluation should never be used for high-stakes content."

---

## 3. 为什么 Superpowers 没把 verification-before-completion 做成 Sub-Agent 模式

### 3.1 设计目标差异

| 技能 | 解决的问题 | 检查类型 |
|------|-----------|----------|
| `verification-before-completion` | **"不验证就撒谎"** — Agent 声称完成但根本没运行测试 | 计算型（运行命令、检查 exit code） |
| `requesting-code-review` | **"代码质量需要独立视角"** — 自己写的代码自己看不出问题 | 推理型（架构、设计、可读性） |

Upstream `verification-before-completion` 的原始设计：

```markdown
The Gate Function:
1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command
3. READ: Full output, check exit code
4. VERIFY: Does output confirm the claim?
5. ONLY THEN: Make the claim
```

这是一个**同一会话内的自我约束流程**。它防止的是"跳过验证步骤"，而不是"验证时看错了结果"。

### 3.2 计算型 vs 推理型检查的根本区分

Harness Engineering 的核心认知：

> **"Computational checks (linter/test) are cheap and reliable. Inferential checks (LLM-as-Judge) are expensive and probabilistic."**

| 维度 | 计算型检查 | 推理型检查 |
|------|-----------|-----------|
| 示例 | `npm test`, `eslint`, `tsc` | "代码架构是否合理？", "需求是否满足？" |
| 偏误风险 | 低（测试要么 pass 要么 fail） | 高（模型会为自己的输出辩护） |
| Sub-agent 价值 | 低（命令输出是客观的） | 高（需要独立视角） |
| 成本效益 | 不值得（sub-agent 也要运行同样命令） | 值得（推理判断需要隔离） |

`verification-before-completion` 主要覆盖计算型检查。
让 sub-agent 来运行 `npm test` 是浪费：

- 测试结果不因"谁运行"而改变
- Sub-agent 需要同样的环境上下文（node_modules、env vars、数据库连接）
- 环境配置失败的风险反而增加

而 `requesting-code-review` 覆盖推理型检查。同一段代码，Generator 可能认为"足够清晰"，独立 Evaluator 可能发现"职责混乱"。这是真正的价值所在。

### 3.3 平台兼容性约束

Superpowers 的设计约束（来自 `writing-skills`）：

> "Skills must work across all of the coding agents we support."

支持的 Agent：Claude Code、OpenAI Codex、Cursor、Gemini CLI、OpenCode、Windsurf、Qwen Code 等。

- **并非所有平台都支持 sub-agent/tool 调用**。例如某些 Cursor 插件环境、轻量级 CLI 工具。
- `verification-before-completion` 作为**纯 Markdown 纪律技能**，可以在任何平台上工作。
- `requesting-code-review` 的 sub-agent 化依赖特定平台的 Agent/Task 工具，但 upstream 通过 `general-purpose` type + template 文件做了最大程度的抽象。

### 3.4 成本与复杂度的工程权衡

Anthropic 三 Agent 实验的成本数据：

- Solo: $9 / 20min
- Harness: $200 / 6h（约 20x）

Superpowers 作为**通用框架**，必须考虑大多数用户的成本承受能力：

- 如果每个任务完成后都启动 sub-agent 运行测试，简单项目的开发成本会暴增
- 对于"运行测试命令"这种操作，sub-agent 的 overhead（启动、加载上下文、执行、报告）远超其价值

Superpowers 的选择是：**让框架提供基础约束，让项目根据复杂度自行决定是否增加 Evaluator 层**。

### 3.5 上下文依赖与环境隔离难题

运行时验证通常依赖 Generator 已经建立的**临时上下文**：

- 环境变量（`DATABASE_URL`, `API_KEY`）
- 测试数据库状态（已 seed 的数据）
- 文件系统状态（临时文件、缓存）
- 网络状态（mock server 是否运行）

如果 Evaluator subagent 在**隔离环境**中启动，它可能连测试都跑不起来。这要求：

1. 完整的上下文传递机制（handoff 文件需包含环境快照）
2. 环境复现能力（Docker/container 或状态序列化）
3. 敏感信息的安全传递（secrets management）

相比之下，`requesting-code-review` 只需要 git diff + plan 文件就能工作，**环境依赖为零**，所以更容易 sub-agent 化。

### 3.6 Superpowers 的渐进式演进哲学

Superpowers 的设计路径反映了一种务实的优先级排序：

| 阶段 | 解决的问题 | 形态 |
|------|-----------|------|
| Phase 1 | **"不验证就撒谎"** — 最普遍、最致命的失败 | `verification-before-completion`（自我约束） |
| Phase 2 | **"代码质量需要独立审查"** — 静态推理检查 | `requesting-code-review`（sub-agent） |
| Phase 3 | **"运行时行为需要独立验证"** — 动态推理检查 | ???（尚未 upstream 化） |

Phase 1 比 Phase 2 更致命：一个 Agent 如果习惯性"声称完成但不验证"，根本走不到代码审查阶段。Superpowers 先解决最痛的问题。

Phase 3（运行时验证的 sub-agent 化）仍是一个**开放问题**。行业中已有实现（Anthropic 的 Playwright Evaluator、rn-launch-harness 的 Maestro 验证），但尚未形成通用框架层面的标准方案。

---

## 4. 三层验证架构方案

基于 Harness Engineering 的底层认知和当前项目现状，提出**三层验证架构**。

> **重要澄清**：本节标题原表述为"verification-before-completion 的升级方案"，
> 存在歧义。`verification-before-completion` 的计算型部分（运行测试命令）
> 不需要也不应该 sub-agent 化。三层架构的目标是**在其后补充 Layer 3**，
> 覆盖目前缺失的推理型运行时验证，而非改造 `verification-before-completion` 本身。

### 4.1 架构总览

```text
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 独立 Evaluator Subagent（推理型验证）              │
│  - 运行时行为验证（Playwright / API 调用 / 数据库查询）        │
│  - 需求满足度审查（对照 Plan/Spec 逐项检查）                 │
│  - 适用：复杂功能、主观判断、无自动化测试覆盖的场景            │
│  执行者：独立 subagent（不同会话/上下文）                     │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 自我约束 Gate Function（计算型验证）               │
│  - 运行测试命令、检查 exit code、读取输出                    │
│  - 保持 upstream 的 IDENTIFY→RUN→READ→VERIFY→CLAIM          │
│  - 适用：有自动化测试覆盖的标准场景                           │
│  执行者：Generator 自身（同一会话）                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 自动化 Harness（确定性检查）                       │
│  - pre-commit hooks（lint, format, type-check）             │
│  - CI 自动化检查（audit_check, spec_plan_sync）              │
│  - 适用：所有提交，零推理成本                                │
│  执行者：lefthook / GitHub Actions                          │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 分层原理

| 层级 | 类型 | 执行者 | 为何这样设计 |
|------|------|--------|-------------|
| Layer 1 | 计算型 | 自动化工具 | 最便宜、最可靠、无偏误。应在最早阶段拦截 |
| Layer 2 | 计算型 | Generator 自身 | 需要实时上下文（测试环境状态），sub-agent 复现成本高。测试结果是客观的，自我偏误风险低 |
| Layer 3 | 推理型 | 独立 Evaluator | 自我偏误最严重。Evaluator 不读代码，而是"使用产品"（像真实用户一样点击、调用 API） |

### 4.3 Layer 3 的具体实现建议

#### 4.3.1 触发条件

不是每个任务都需要 Layer 3。触发条件：

```markdown
- [ ] 任务涉及用户可见行为变更（UI、API 响应格式）
- [ ] 任务无自动化测试覆盖（遗留代码、探索性实现）
- [ ] 任务验收标准包含主观判断（"用户体验流畅"、"设计符合规范"）
- [ ] 任务被标记为 high-risk（security、payment、auth）
- [ ] Layer 2 验证通过但 Generator 对质量有疑虑
```

#### 4.3.2 Handoff 协议

Generator 完成 Layer 2 后，向 Evaluator 传递结构化 handoff 文件：

```yaml
---
evaluator_input:
  task_id: "issue-13"
  task_description: "补充 Layer 3 独立运行时验证（meta-runtime-evaluator）"
  plan_reference: "docs/superpowers/plans/issue-13.md"
  spec_reference: "docs/superpowers/specs/issue-13.md"
  generator_claims:
    - "创建了新的 meta-runtime-evaluator skill"
    - "实现了三层验证架构文档"
    - "所有现有测试通过"
  test_results:
    command: "npm test"
    exit_code: 0
    summary: "34/34 pass, coverage 87%"
  changed_files:
    - path: "docs/superpowers/handoffs/generator-evaluator-research-2026-05-28.md"
      diff_sha: "a1b2c3d"
  verification_commands:
    - "npm run test:integration"
    - "npm run lint"
  sprint_contract:
    - "文档必须包含架构总览图"
    - "必须分析 superpowers 未做的原因"
    - "必须提供可执行的实现建议"
---
```

#### 4.3.3 Evaluator 的工作流程

```markdown
1. 阅读 Sprint Contract 和验收标准
2. 阅读 Plan/Spec，理解预期行为
3. 检查 changed_files（但不深入代码逻辑）
4. 执行 verification_commands（独立运行）
5. 对照 sprint_contract 逐项验证
6. 输出结构化报告
```

#### 4.3.4 Evaluator 输出格式

```markdown
## 运行时验证报告

### Sprint Contract 检查
| 标准 | 状态 | 证据 |
|------|------|------|
| 文档包含架构总览图 | ✅ PASS | 章节 4.1 包含三层架构图 |
| 分析 superpowers 未做的原因 | ✅ PASS | 章节 3 含 6 个维度分析 |
| 提供可执行的实现建议 | ✅ PASS | 章节 4.3 含 handoff 协议和输出格式 |

### 独立验证
| 检查项 | 命令 | 结果 |
|--------|------|------|
| markdownlint | `npx markdownlint-cli2 "docs/**/*.md"` | 0 errors |
| 链接检查 | `npx markdown-link-check` | 0 broken |

### 总体评估
- **verdict**: PASS
- **confidence**: HIGH
- **note**: 文档结构清晰，证据充分。建议下步行动：将本报告中的实现建议转化为具体的 skill 文件。
```

### 4.4 与现有项目组件的整合

当前项目已有一些 Evaluator 类组件，升级应与其整合：

| 现有组件 | 当前角色 | 升级后角色 |
|----------|---------|-----------|
| `meta-safe-executor` | 写操作安全审计（Git 快照、Changelog） | **Layer 1 增强** — 在审计中增加"是否需要 Layer 3 验证"的判断 |
| `requesting-code-review` | 静态代码审查（sub-agent） | **Layer 3 的一部分** — 但仅覆盖代码质量，不覆盖运行时行为 |
| `meta-distiller` | 资产提纯 | 不变 — 在闭环阶段执行，不受验证层级影响 |
| `verification-before-completion` | 自我约束 Gate Function | **Layer 2** — 保留并明确其定位，不作为唯一验证手段 |

建议新增的自定义 skill：

**`meta-runtime-evaluator`**

- 路径：`.gemini/skills/meta-runtime-evaluator/SKILL.md`
- 触发：Layer 2 完成后，由 Generator 或 `meta-safe-executor` 判断是否触发
- 输入：handoff 文件（Sprint Contract + 验证命令 + 变更摘要）
- 输出：结构化验证报告（PASS/FAIL + 证据）

---

## 5. 关键洞察：Superpowers 与 Harness Engineering 的分工边界

这次调研揭示了一个重要的架构分层：

```text
┌─────────────────────────────────────────┐
│  项目自定义 Harness 层（Base-AI-Driven）  │
│  - meta-runtime-evaluator（运行时验证）  │
│  - meta-safe-executor（安全审计）        │
│  - ops_changelog（审计日志）             │
│  - CI 三级检查 + Local Hooks             │
├─────────────────────────────────────────┤
│  Superpowers 扩展技能（Fork 维护）        │
│  - 提供完整工作流技能栈（从 brainstorming │
│    到 finishing-branch）                  │
│  - 项目在验证维度上补充 Layer 3 Evaluator │
├─────────────────────────────────────────┤
│  AI CLI Harness（工具原生）              │
│  - Kimi Code / Gemini CLI / Codex CLI   │
│  - 提供 Agent/Subagent 能力              │
└─────────────────────────────────────────┘
```

**Superpowers 不做运行时 Evaluator sub-agent，不是缺陷，而是设计边界**：

- Superpowers = **完整工作流技能栈**（怎么做）— 已覆盖 Plan/Act/Verify/Close 全周期
- Harness Engineering = **环境层**（在哪做、谁来做、怎么约束）— 补充架构分离和运行时隔离
- 两者互补，不是替代

Base-AI-Driven-Template 的价值在于：
**在 Superpowers 基础之上，根据 Harness Engineering 的底层认知，构建项目特定的深度 harness**。
这正是 `meta-xxx` 系列 skill 存在的原因。

---

## 6. 跨平台适配层设计（平台无关原则）

### 6.1 设计约束来源

Superpowers 的核心设计原则：

> "Skills must work across all of the coding agents we support."

支持的 Agent 包括：Claude Code、OpenAI Codex、Cursor、Gemini CLI、OpenCode、Windsurf、Qwen Code 等。

### 6.2 三层抽象架构

Layer 3 Evaluator 的设计必须分层，避免绑定任何特定平台的工具：

```text
┌─────────────────────────────────────────┐
│  Skill 文档层（纯 Markdown，平台无关）    │
│  - 描述"需要独立 Evaluator 验证运行时行为"│
│  - 定义 Sprint Contract 和 Handoff 格式  │
│  - 定义验收标准和证据格式                 │
│  - 不规定具体工具调用方式                 │
├─────────────────────────────────────────┤
│  平台适配层（各 AI CLI 自行实现）          │
│  - Claude Code: Task tool (subagent)     │
│  - Kimi Code: Agent 工具                  │
│  - Gemini CLI: agent 模式                │
│  - Cursor: .cursor/agents/*.md 定义      │
│  - Codex CLI: agent 模式                  │
├─────────────────────────────────────────┤
│  项目基础设施层（平台无关）                │
│  - Playwright / Cypress / Puppeteer      │
│  - API 测试脚本（bash/curl/httpie）       │
│  - 验收标准 checklist（Markdown）          │
│  - 证据目录 `evaluator-evidence/`          │
└─────────────────────────────────────────┘
```

### 6.3 Skill 文档的写法边界

**Skill 文档只能写到这个程度：**

```markdown
## 运行时验证（平台无关描述）

1. **启动被测服务**：根据项目类型执行启动命令
   - Web 项目：`npm run dev` 或 `npm start`
   - API 项目：`docker compose up` 或 `npm run start:api`
   - CLI 项目：`npm run build` 生成可执行文件

2. **执行验证场景**：使用项目已配置的测试工具
   - 浏览器行为：运行 `npm run test:e2e`
   - API 行为：运行 `npm run test:api`
   - CLI 行为：执行构建产物并验证输出

3. **收集证据**：截图、网络日志、命令输出保存到 `evaluator-evidence/`

4. **输出 verdict**：PASS/FAIL + 证据路径列表
```

**不能写的（平台特定）：**

- ❌ "使用 Kimi Code 的 Agent 工具 dispatch subagent"
- ❌ "使用 Claude Code 的 Task tool"
- ❌ "使用 Shell 工具运行命令"

### 6.4 各平台执行差异对照

| 平台 | Subagent 机制 | 命令执行 | 证据收集 |
|------|--------------|---------|---------|
| Claude Code | `Task` tool | `shell` tool | 内置文件读取 |
| Kimi Code | `Agent` tool | `Shell` tool | `ReadMediaFile` |
| Gemini CLI | `agent` 模式 | `run` command | 有限支持 |
| Cursor | `.cursor/agents/*.md` | Terminal | 手动/插件 |
| Codex CLI | `agent` 模式 | `shell` tool | 内置文件读取 |

### 6.5 对 Layer 3 实现的影响

这意味着 `meta-runtime-evaluator` skill 的设计必须**足够抽象**：

- **输入**：平台无关的 handoff 文件（Markdown/YAML）
- **处理**：由当前平台的 Agent 用自己的 subagent 机制执行
- **输出**：平台无关的验证报告（Markdown）

项目基础设施（Playwright 脚本、API 测试）是平台无关的，
由 Evaluator subagent 通过该平台支持的命令执行方式调用。

---

## 7. 下一步行动建议

| 优先级 | 行动 | 预估工时 | 依赖 |
|--------|------|---------|------|
| P1 | 创建 `meta-runtime-evaluator` skill 初稿 | 2h | 本调研报告 |
| P2 | 在 `meta-safe-executor` 中增加"是否需要 Layer 3"判断逻辑 | 1h | meta-runtime-evaluator 就绪 |
| P2 | 更新 `docs/superpowers/lifecycle.md`，在验证阶段标注三层架构 | 1h | 本调研报告 |
| P3 | 在下一个实际任务中试点 Layer 3 验证，收集反馈 | - | 有合适任务时 |
| P3 | 将试点经验提炼为可复用的 handoff 模板 | 1h | 试点完成后 |
| P3 | 制定上下文管理策略（compaction/reset/handoff 触发条件） | 2h | 有长任务需求时 |

---

## 8. 参考来源

- [obra/superpowers - verification-before-completion SKILL.md](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md)
- [obra/superpowers - requesting-code-review SKILL.md](https://github.com/obra/superpowers/blob/main/skills/requesting-code-review/SKILL.md)
- [obra/superpowers - subagent-driven-development SKILL.md](https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/SKILL.md)
- [OpenAI Harness Engineering 原始文章 (2026-02)](https://openai.com/index/harness-engineering/)
- [Anthropic Harness Design for Long-Running Application Development (2026-03)](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Martin Fowler 综述 (2026-04)](https://martinfowler.com/articles/harness-engineering.html)
- [O'Reilly / Addy Osmani 深度解析 (2026-04)](https://oreilly.com/radar/agent-harness-engineering/)
- [Milvus 行业综述：Harness Engineering 实践](https://milvus.io/blog/harness-engineering-ai-agents.md)
- [CSDN：独立 Evaluator —— 为什么让模型自评 = 养蛊](https://blog.csdn.net/qcx23/article/details/160866794)

---

*本文档用于跨会话/跨 Agent 上下文接续。修改时请更新版本号和时间戳。*

## 8. 修正案（Amendments）

### Amendment 1: Superpowers 角色描述修正（2026-05-28）

**原始偏差：**

文档第 5 节及架构图中将 Superpowers 描述为"提供基础纪律技能"和"纪律层（怎么做）"，
过度简化了其真实作用。

**修正内容：**

Superpowers 实际上提供了**覆盖完整生命周期的技能栈**：
`brainstorming` → `using-git-worktrees` → `writing-plans` → `executing-plans` /
`subagent-driven-development` → `test-driven-development` →
`requesting-code-review` → `verification-before-completion` →
`finishing-a-development-branch`。

更准确的定位是：

> Superpowers 提供了"怎么做"的完整工作流技能栈，但在 Generator/Evaluator
> 架构分离这个维度上，选择了同一会话自我约束模式
>（`verification-before-completion`），而非独立的 sub-agent 验证模式。

**影响范围：**

- 本节（第 5 节）架构图已更新
- 关联文档 `harness-engineering-research-2026-05-27.md` 第 4.2 节已同步更新

### Amendment 2: Layer 3 实现的平台无关化（2026-05-28）

**原始偏差：**

第 4.3 节在描述 Layer 3 Evaluator 的具体实现时，过度绑定了 Kimi Code 的
`Agent` 工具和 `Shell` 工具，忽略了跨平台约束。

**修正内容：**

新增第 6 节"跨平台适配层设计"，明确三层抽象：

1. **Skill 文档层**：纯 Markdown，平台无关，只描述"需要做什么"
2. **平台适配层**：各 AI CLI 用自己的 subagent 机制执行
3. **项目基础设施层**：Playwright/API 测试脚本等是平台无关的

Skill 文档的写法边界：

- ✅ 可以写："运行 `npm run test:e2e`"
- ❌ 不能写："使用 Kimi Code 的 Agent 工具 dispatch subagent"

### Amendment 3: 讨论留档决策（2026-05-28）

**决策：** 将本轮讨论中的关键认知迭代以修正案形式追加到本 handoff 文档，
不新建独立文件，避免碎片化。

**留档范围：**

- 文档偏差发现 → 已修正并记录
- 跨平台设计约束 → 已追加第 6 节
- 认知迭代（从 Kimi Code 实现退回平台无关抽象） → 已记录

### Amendment 4: 升级目标澄清（2026-05-28）

**原始偏差：**

第 4 节标题原表述为"verification-before-completion 的升级方案"，
与第 3.1 节的分析存在逻辑矛盾：

- 第 3.1 节指出 `verification-before-completion` 是计算型检查，
  sub-agent 价值低
- 但第 4 节标题暗示要将其"升级"为 sub-agent 模式

**用户指出的核心问题：**

> "requesting-code-review 是推理型，而 verification-before-completion 是计算型，
> 计算型不是根本没必要 sub-agent 吗，那我们的操作不应该是针对
> requesting-code-review 吗？"

**修正内容：**

1. **`requesting-code-review` 已经是 sub-agent 模式**
   （upstream 通过 Task tool dispatch code-reviewer subagent），
   覆盖**静态代码质量审查**。不需要重做。

2. **`verification-before-completion` 不需要整体升级**。它的计算型部分
   （IDENTIFY→RUN→READ）保留在 Generator 会话内执行。

3. **真正需要补充的是 Layer 3 独立运行时验证**。`verification-before-completion`
   的 VERIFY 步骤（判断"任务是否真正完成"、"需求是否满足"）是**推理型**的，
   但目前由 Generator 自己执行，存在自我偏误。

4. **正确表述**：不是"升级 verification-before-completion"，而是
   "在 `verification-before-completion`（Layer 2）之后，补充
   `meta-runtime-evaluator`（Layer 3），覆盖推理型运行时验证"。

**影响范围：**

- 第 4 节标题已修正为"三层验证架构方案"
- 第 4.3.2 节 handoff 示例中的 task_description 已修正
- 本修正案永久记录此次逻辑澄清

---

*本文档用于跨会话/跨 Agent 上下文接续。修改时请更新版本号和时间戳。*
