## 开发、生产生命周期

描述一个任务从需求探索到代码合并的全流程物理轨迹，深度融合 Superpowers 以确保工程质量，并明确人机交互与错误处理。

```mermaid
sequenceDiagram
    autonumber
    participant D as Driver (用户)
    participant AI as Engine (AI 引擎)
    participant VCS as 版本控制系统
    participant CI as GitHub Actions (CI/CD)

    Note over D, AI: 1-3. 启动阶段 (Launch)
    AI->>AI: activate_skill brainstorming (需求探索 & 编写 Spec)<br/><i>(AI 暂停，等待 Driver 确认设计规范 Spec 位于 docs/superpowers/specs/)</i>
    D->>AI: 确认 Spec
    AI->>VCS: gh issue create (使用 Issue Template 创建 Issue)<br/><i>(关联 Spec/Plan 文档路径)</i>
    AI->>VCS: git checkout -b issue-N (分支隔离)<br/><i>(若失败，AI 报告给 Driver，等待指示)</i>

    Note over AI, VCS: 4-6. 计划与执行 (Plan & Act)
    AI->>AI: activate_skill writing-plans (生成计划 & 编写 Plan)<br/><i>(AI 暂停，等待 Driver 批准 Plan 位于 docs/superpowers/plans/)</i>
    AI->>AI: activate_skill executing-plans (按 Task 逐步执行计划)<br/><i>(若执行失败，AI 重试/升级给 Driver)</i>
    AI->>AI: activate_skill meta-safe-executor (安全审计)<br/><i>(若检测到风险，AI 报告给 Driver，等待指令)</i>

    Note over AI, D: 7-9. 质量与验证 (Test & Verify)
    AI->>AI: activate_skill test-driven-development (TDD 循环)<br/><i>(遇歧义时，AI 进入"等待 Driver 问询/澄清"状态)</i>
    AI->>AI: 语法检查 (node --check) + 冒烟测试<br/><i>(AI 向 Driver 呈现验证证据摘要)</i>
    AI->>AI: activate_skill verification-before-completion (产出物证据)<br/><i>(AI 向 Driver 呈现证据摘要)</i>

    Note over AI, D: 10-13. 提纯与闭环 (Distill & Close)
    AI->>AI: activate_skill meta-distiller (资产提纯)<br/><i>(AI 暂存结果，等待 Driver 审查/Accept 提纯资产)</i>
    AI->>VCS: git commit & update ops_changelog.md (提交变更 & 更新审计日志)
    AI->>VCS: gh pr create (创建 PR)<br/><i>🔒 自动触发 CI 检查：审计日志、Spec/Plan 同步、AI 审查</i>
    CI->>CI: 执行自动化检查<br/><i>🔴 audit_check (强制) + 🟡 spec_plan_sync + ai_review (建议)</i>
    D->>VCS: gh pr merge (Driver 批准并合并 PR)<br/><i>🔒 触发 close_loop 知识闭环 (Issue 回帖 + CHANGELOG 自动更新)</i>
    CI->>VCS: git commit (自动更新 CHANGELOG.md)
    AI->>VCS: gh issue close (Issue 关闭)<br/><i>(仅在 PR 合并且 Driver 确认后执行)</i>

    Note over AI: 14. 流程反馈与自我反思 (Feedback & Self-Reflection)
    AI->>AI: perform_self_reflection & update_ops_changelog<br/><i>(总结执行情况，记录挑战，为智力演进提供输入)</i>
```

---

---

# 工程标准索引 (Engineering Standards Index)

AI 引擎在执行任务时，必须参考以下标准文档以确保工程质量。**严禁跳过规范直接编写代码。**

| 领域 | 规范文档路径 | 适用阶段 |
| :--- | :--- | :--- |
| **代码质量** | `docs/standards/code-standards/README.md` | 执行 (Act) |
| **测试驱动** | `docs/standards/test-driven-development.md` | 验证 (Verify) |
| **API 设计** | `docs/standards/api-design-standards.md` | 启动 (Launch) |
| **系统安全** | `docs/standards/security-standards.md` | 计划/执行 |
| **日志记录** | `docs/standards/logging-standards.md` | 执行 (Act) |
| **环境配置** | `docs/standards/environment-standards.md` | 启动/执行 |
| **代码审查** | `docs/standards/review-standards/review/reviewer/` | 闭环 (Close) |
| **提交描述** | `docs/standards/review-standards/review/developer/` | 闭环 (Close) |

---

# 人机交互规范 (Human-in-the-Loop Standards)

### 1. AI 暂停点 (AI Pause Points)

在以下关键节点，AI 必须暂停并等待 Driver 确认：

| 阶段     | 暂停点              | 等待内容                                                |
| -------- | ------------------- | ------------------------------------------------------- |
| **启动** | `brainstorming` 后  | Driver 确认初步方案                                     |
| **设计** | `brainstorming` 后  | Driver 确认设计规范 Spec (位于 docs/superpowers/specs/) |
| **计划** | `writing-plans` 后  | Driver 批准 Plan (位于 docs/superpowers/plans/)         |
| **执行** | 遇到风险操作        | Driver 指令（如破坏性变更）                             |
| **验证** | 测试失败/歧义       | Driver 澄清或调整预期                                   |
| **提纯** | `meta-distiller` 后 | Driver 审查资产                                         |
| **闭环** | 合并请求创建后      | Driver 合并确认                                         |

### 2. AI 升级条件 (Escalation Conditions)

当遇到以下情况时，AI 应将问题升级给 Driver：

- **执行失败**：`executing-plans` 连续失败 3 次以上。
- **风险检测**：`meta-safe-executor` 检测到高风险操作（如数据迁移、核心逻辑重构）。
- **歧义阻塞**：TDD 测试中发现需求歧义，无法继续。
- **资源不足**：需要外部 API 密钥、设计资源或跨团队协调。

### 3. 证据呈现规范 (Evidence Presentation)

AI 在 `verification-before-completion` 阶段必须呈现以下证据：

```markdown
### 验证证据

- [ ] 单元测试通过率：X/Y
- [ ] 手动测试截图/录屏：[附件]
- [ ] 性能对比：优化前后数据
- [ ] 兼容性测试：相关平台/环境
```

---

# Issue 创建最佳实践

**⚠️ Windows 环境注意**：使用 `gh issue create` 时，**必须使用 `--body-file` 参数**，避免 `--body "文本"` 导致 Markdown 内容丢失。

```bash
# ✅ 正确方式：使用临时文件
echo "## 📋 需求描述..." > temp_body.md
gh issue create --title "标题" --body-file temp_body.md --label "enhancement"
del temp_body.md

# ❌ 错误方式：Windows 下 Markdown 内容会丢失
gh issue create --title "标题" --body "## 内容..."
```

---
