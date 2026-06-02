---
handoff_id: harness-engineering-research-2026-05-27
author: AI Assistant
created: 2026-05-27
status: active
next_actions:
  - priority: 1
    task: AGENTS.md 内容精简（< 80 行地图化）
    est_effort: 2h
  - priority: 2
    task: Local Hooks 层（pre-commit / lefthook）
    est_effort: 1d
  - priority: 3
    task: Worktree 自动化脚本（scripts/worktree-manager）
    est_effort: 0.5d
  - priority: 4
    task: Generator/Evaluator 分离（从 code-review subagent 开始）
    est_effort: 1-2d
---

# Harness Engineering 调研与项目反思 —— 上下文交接文档

## 1. 本次调研目标

理解 Harness Engineering 的底层认知（不依赖于任何 AI 工具），反思 Base-AI-Driven-Template 项目是否具备对应特征，并决定与 superpowers 的关系。

## 2. Harness Engineering 核心认知摘要

### 2.1 第一性原理

- **Agent = Model + Harness**。Harness 是模型之外的一切。
- **三层演进**：Prompt Engineering → Context Engineering → Harness Engineering
- **Feedforward + Feedback**：Guide（行动前引导）与 Sensor（行动后纠正）缺一不可
- **Computational vs Inferential**：计算型检查（linter/test）便宜可靠，推理型检查（LLM-as-Judge）昂贵概率性
- **The Ratchet**：每个 Agent 错误必须转化为环境规则（Harness 的永久修复）
- **Context Rot**：上下文腐烂必须对抗（Compaction / Offloading / Reset）
- **Self-Evaluation Bias**：Generator 与 Evaluator 必须架构分离（GAN 式对抗）
- **Co-evolution**：Harness 组件编码了"模型不能做什么"的假设，模型变强后组件应被移除

### 2.2 核心组件

| 组件 | 作用 | 关键原则 |
|------|------|----------|
| Filesystem + Git | 持久状态、协作表面 | 无文件系统即无工作流 |
| AGENTS.md | 最高杠杆配置点 | **< 100 行，地图不是百科全书** |
| Hooks | 生命周期拦截 | Success is silent; failures are verbose |
| Sandbox | 运行时隔离 | Bash 只在安全的地方才有价值 |
| Memory/Search | 跨会话知识持久化 | 混合检索（语义+BM25）是刚需 |
| Planner/Generator/Evaluator | 长程任务与质量验证 | Sprint Contract：先协商"完成"定义 |
| Worktree | 并行分支隔离 | 每个任务独立目录 |

## 3. 项目当前状态评估

### 3.1 已具备的优势（✅）

- AGENTS.md 作为地图（117 行，接近 100 行目标）
- 渐进式文档结构（docs/standards/ 分散存储）
- Superpowers 技能系统（.gemini/skills/ 含 meta-distiller, meta-safe-executor 等）
- CI 三级检查（audit_check 强制、spec_plan_sync 建议、ai_review 建议）
- 审计日志（.gemini/ops_changelog.md）
- 人机交互规范（AI Pause Points、Escalation、Evidence Presentation）
- 生命周期定义完整（Launch → Plan & Act → Test & Verify → Distill & Close）

### 3.2 缺失/待优化（⚠️）

| 缺失项 | 影响 | 建议优先级 |
|--------|------|------------|
| Local Hooks 层 | 只有 CI 反馈，无本地强制 | P1 |
| 机械化架构约束 | docs/standards/ 是文档，不可机械执行 | P1 |
| Generator/Evaluator 分离 | 自我验证系统性偏差 | P2 |
| Worktree 自动化 | 用户要求并行开发但无工具支持 | P2 |
| 上下文管理策略 | 长任务无 compaction/reset 策略 | P3 |
| Garbage Collection | 无定期架构漂移扫描 | P3 |
| AGENTS.md 精简 | Mermaid 图和命令细节挤占上下文 | P1 |

## 4. Superpowers 分析与决策

### 4.1 Superpowers 是什么

- obra (Jesse Vincent) 的 MIT 开源项目，116k+ stars
- **纯 Markdown 技能框架**，零依赖，多平台（Claude Code/Cursor/Codex/Gemini CLI/OpenCode）
- v2.0 后技能仓库分离为 `obra/superpowers-skills`，支持 fork + 分支 workflow
- 核心技能：brainstorming, writing-plans, executing-plans, TDD,
  systematic-debugging, verification-before-completion,
  subagent-driven-development, using-git-worktrees,
  finishing-a-development-branch, requesting-code-review,
  receiving-code-review, writing-skills, using-superpowers

### 4.2 与 Harness Engineering 的关系

- **Superpowers = 完整工作流技能栈（怎么做）** — 覆盖从 brainstorming 到 finishing-branch 的全生命周期
- **Harness Engineering = 环境层（在哪做、怎么约束、谁来做）** — 关注架构分离、上下文管理、运行时隔离
- 两者互补，不是替代

### 4.3 决策：Fork + 扩展（混合策略）

**不建议抛弃 superpowers，也不建议完全依赖 upstream。**

推荐架构：

```text
┌─────────────────────────────────────────┐
│  自定义 Harness 层（自己维护）            │
│  - meta-distiller / meta-safe-executor  │
│  - ops_changelog 审计                     │
│  - CI 检查 (audit/spec-plan/ai-review)   │
│  - Local Hooks (pre-commit)              │
│  - Generator/Evaluator 分离              │
├─────────────────────────────────────────┤
│  Superpowers 扩展技能（Fork 维护）         │
│  - 基于 obra/superpowers-skills fork      │
│  - 保留上游核心技能                        │
│  - 自定义增加 meta-xxx, code-reviewer     │
├─────────────────────────────────────────┤
│  AI CLI Harness（工具原生）               │
│  - Kimi Code / Gemini CLI / Codex CLI    │
└─────────────────────────────────────────┘
```

**执行方式**：

1. Fork `obra/superpowers-skills`（不是 superpowers 插件）
2. 将 `.gemini/skills/` 中的自定义技能按 superpowers `writing-skills` 标准格式化，放入 fork 的 `skills/custom/`
3. 使用 `pulling-updates-from-skills-repository` 技能定期同步 upstream
4. 保留 meta-safe-executor、ops_changelog 等项目特有 Harness 组件完全自主控制

## 5. 建议的下一步行动（已按 ROI 排序）

### Action 1: AGENTS.md 精简（2h）

- 保留：生命周期地图、标准索引、暂停点、升级条件
- 移出：Mermaid 图 → `docs/superpowers/lifecycle.md`；Windows gh 提示 → `docs/superpowers/tips.md`
- 目标：< 80 行，每条规则标注 Ratchet 来源

### Action 2: Local Hooks 层（1d）

- 增加 `lefthook.yml` 或 `.pre-commit-config.yaml`
- 包含：lint-staged、forbid-destructive、check-agents-md-size
- 原则：Success is silent; failures are verbose

### Action 3: Worktree 自动化脚本（0.5d）

- 创建 `scripts/worktree-manager.sh` / `.ps1`
- 封装：create / list / cleanup
- AGENTS.md 增加指向该脚本的地图条目

### Action 4: Generator/Evaluator 分离（1-2d）

- 从 code-review 入手，创建独立 subagent（Evaluator）
- 与 Generator 架构隔离（不同会话/上下文）
- 参考 superpowers `requesting-code-review` 但改为强制 subagent 执行

## 6. 关键引用与来源

- OpenAI Harness Engineering 原始文章 (2026-02): `openai.com/index/harness-engineering/`
- Martin Fowler 综述 (2026-04): `martinfowler.com/articles/harness-engineering.html`
- O'Reilly / Addy Osmani 深度解析 (2026-04): `oreilly.com/radar/agent-harness-engineering/`
- Anthropic 长程 Harness 设计 (2026): `Harness Design for Long-Running Application Development`
- obra/superpowers: `github.com/obra/superpowers`
- obra/superpowers-skills (v2.0): `github.com/obra/superpowers-skills`

## 7. 风险与注意事项

- **Windows 环境**：使用 `gh issue create` 时必须用 `--body-file`，不能用 `--body`（Markdown 会丢失）—— 此规则已在 AGENTS.md 中，精简后应保留在 `docs/superpowers/tips.md`
- **Context Rot**：当前项目无长任务 handoff 策略，若任务超过 1 小时需人工介入
- **Superpowers v2.0 Breaking Change**：技能仓库已分离，旧版 shadowing 系统已移除，升级需备份
- **Multi-Agent 冲突**：并行开发时若两个 worktree 修改同一文件，需合并时冲突检测

---
*本文档用于跨会话/跨 Agent 上下文接续。修改时请更新版本号和时间戳。*
