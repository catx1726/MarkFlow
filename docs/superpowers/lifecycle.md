# 开发、生产生命周期

描述一个任务从需求探索到代码合并的全流程物理轨迹，深度融合 Superpowers 以确保工程质量，并明确人机交互与错误处理。

```mermaid
sequenceDiagram
    autonumber
    participant D as Driver (用户)
    participant AI as Engine (AI 引擎)
    participant VCS as 版本控制系统
    participant CI as GitHub Actions (CI/CD)

    Note over D, AI: 1-3. 启动阶段 (Launch)
    AI->>AI: 工作流选择检查<br/><i>(范围 ≤10 文件 + 目标明确 + 无架构变更？→ Surgical Workflow)</i>
    alt 使用 Surgical Workflow
        AI->>AI: 按 surgical-workflow-concept.md 执行<br/><i>(逻辑 MRI → 安全垫 → 极简计划 → 增量开发 → 闭环)</i>
    else 使用标准生命周期
        AI->>AI: activate_skill brainstorming (需求探索 & 编写 Spec)<br/><i>(AI 暂停，等待 Driver 确认设计规范 Spec 位于 docs/superpowers/specs/)</i>
        D->>AI: 确认 Spec
        AI->>VCS: gh issue create (使用 Issue Template 创建 Issue)<br/><i>(关联 Spec/Plan 文档路径)</i>
        AI->>VCS: git checkout -b issue-N (分支隔离)<br/><i>(若失败，AI 报告给 Driver，等待指示)</i>

        Note over AI, VCS: 4-6. 计划与执行 (Plan & Act)
    AI->>AI: activate_skill writing-plans (生成计划 & 编写 Plan)<br/><i>(AI 暂停，等待 Driver 批准 Plan 位于 docs/superpowers/plans/)</i>
    AI->>AI: activate_skill executing-plans (按 Task 逐步执行计划)<br/><i>(若执行失败，AI 重试/升级给 Driver)</i>
    AI->>AI: activate_skill meta-safe-executor (安全审计)<br/><i>(若检测到风险，AI 报告给 Driver，等待指令)</i>
    Note over AI: 上下文管理检查<br/><i>(>30min 或 >25 文件 → 执行 Compaction/Offloading/Reset)</i>

    Note over AI, D: 7-9. 质量与验证 (Test & Verify)
    AI->>AI: activate_skill test-driven-development (TDD 循环)<br/><i>(遇歧义时，AI 进入"等待 Driver 问询/澄清"状态)</i>
    AI->>AI: 语法检查 (node --check) + 冒烟测试<br/><i>(Layer 1: CI/Hook + Layer 2: Generator 自检)</i>
    AI->>AI: activate_skill verification-before-completion (计算型验证)<br/><i>(运行测试命令，检查 exit code)</i>
    AI->>AI: activate_skill meta-runtime-evaluator (推理型验证)<br/><i>(Layer 3: 独立 Evaluator 验证运行时行为，可选触发)</i>

    Note over AI, D: 10-13. 提纯与闭环 (Distill & Close)
    AI->>AI: activate_skill meta-distiller (资产提纯)<br/><i>(AI 暂存结果，等待 Driver 审查/Accept 提纯资产)</i>
    AI->>VCS: git commit & update ops_changelog.md (提交变更 & 更新审计日志)
    AI->>VCS: gh pr create (创建 PR)<br/><i>🔒 自动触发 CI 检查：审计日志、Spec/Plan 同步、AI 审查、文档结构</i>
    CI->>CI: 执行自动化检查<br/><i>🔴 audit_check (强制) + 🟡 spec_plan_sync + ai_review (建议) + 🟢 check-docs-structure (强制)</i>
    D->>VCS: gh pr merge (Driver 批准并合并 PR)<br/><i>🔒 触发 close_loop 知识闭环 (Issue 回帖 + CHANGELOG 自动更新)</i>
    CI->>VCS: git commit (自动更新 CHANGELOG.md)
    AI->>VCS: gh issue close (Issue 关闭)<br/><i>(仅在 PR 合并且 Driver 确认后执行)</i>

    Note over AI: 14. 流程反馈与自我反思 (Feedback & Self-Reflection)
    AI->>AI: perform_self_reflection & update_ops_changelog<br/><i>(总结执行情况，记录挑战，为智力演进提供输入)</i>
```

## 阶段说明

| 阶段 | 名称 | 核心技能 | 产出物 |
|------|------|----------|--------|
| 1-3 | 启动 (Launch) | `brainstorming` | Spec + Issue |
| 4-6 | 计划与执行 (Plan & Act) | `writing-plans`, `executing-plans`, `meta-safe-executor` | Plan + 代码变更 |
| 7-9 | 质量与验证 (Test & Verify) | `test-driven-development`, `verification-before-completion`, `meta-runtime-evaluator` | 测试通过 + 三层验证证据 |
| 10-13 | 提纯与闭环 (Distill & Close) | `meta-distiller` | PR + 审计日志 |
| 14 | 反馈与反思 | `perform_self_reflection` | ops_changelog 更新 |
