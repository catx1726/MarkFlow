# Issue / PR 最佳实践

## Windows 环境注意事项

### gh issue create 必须使用 `--body-file`

**⚠️ 原因**：Windows 下 `--body "文本"` 会导致 Markdown 内容丢失。

```bash
# ✅ 正确方式：使用临时文件
echo "## 📋 需求描述..." > temp_body.md
gh issue create --title "标题" --body-file temp_body.md --label "enhancement"
rm temp_body.md

# ❌ 错误方式：Windows 下 Markdown 内容会丢失
gh issue create --title "标题" --body "## 内容..."
```

## Worktree 快速命令

本项目使用 **superpowers `using-git-worktrees` skill** 管理 worktree。Agent 会自动按规范执行。

如需手动操作，项目命名规范为：

```bash
# 创建隔离工作区
git worktree add ../<repo>-issue-N -b issue-N-feature-name

# 进入工作区工作
cd ../<repo>-issue-N

# 完成后清理
git worktree remove ../<repo>-issue-N
```

## 破坏性操作 checklist

执行以下操作前必须记录审计日志并确认：

- `rm -rf` 删除目录
- `git push --force`
- 数据库迁移 / schema 变更
- 核心逻辑重构

## 上下文管理快速参考

长任务中 AI 可能出现**上下文腐烂**（遗忘早期决策）或**上下文焦虑**
（ prematurely wrapping up）。参考 `docs/superpowers/context-management-strategy.md`。

### 触发信号（满足任一即执行）

- 连续执行超过 **60 分钟**
- 修改/读取文件超过 **25 个**
- AI 开始重复之前的分析
- AI 主动说"让我简要总结"

### 三种策略

| 策略 | 操作 | 适用场景 |
|------|------|---------|
| **Compaction** | 精简 todo、归档决策、删除已完成分支详情 | 同一会话内，上下文臃肿但未失效 |
| **Offloading** | 将大段分析写入文件，会话只留引用 | 调研报告、Logic MRI 输出 |
| **Reset** | 结束会话，新建会话，通过 handoff 文件接续 | 超过 2h 或 AI 多次出现焦虑症状 |

### Reset Handoff 文件位置

```text
docs/superpowers/evaluator-handoffs/<task-id>-<timestamp>.md
```

### 危险信号

- 🟡 AI 说"由于上下文限制，我简要说明..." → **立即 Reset**
- 🟡 AI 遗忘了 10 分钟前的决策 → **立即 Compaction**
- 🟡 同一任务 Reset 超过 3 次 → **任务拆分过粗，需要重新 Plan**

## 技能同步（跨平台）

本项目技能存储在平台无关的 `skills/` 目录，通过脚本同步到各 AI CLI 平台。

```bash
# 默认同步到 .gemini/skills/
bash scripts/sync-skills.sh

# 同步到多个平台
bash scripts/sync-skills.sh --target .gemini/skills --target .claude/skills
```

```powershell
# PowerShell
.\scripts\sync-skills.ps1 -Target .gemini/skills
```

## 合规检查快速参考

任务完成前，激活 `meta-compliance-checker` skill 并逐项勾选 checklist：

- **安全标准**：输入校验 / 敏感信息 / 错误响应 / 权限检查 / 最小权限
- **TDD 标准**：测试先行 / 回归测试 / 测试通过 / 覆盖合理
- **日志标准**：级别正确 / 无敏感信息 / 结构化 / 上下文完整
- **文档结构**：文件名规范 / front matter 完整 / 目录正确

违规记录：`docs/superpowers/handoffs/` 中的任务 handoff 或 `.project/compliance_log.md`

> **Surgical Workflow 精简版**：使用手术切入式工作流时，只需勾选 3 项阻断项（输入校验 / 无敏感信息 / 测试通过），无需完整 checklist。详见 `docs/superpowers/surgical-workflow-concept.md`。
