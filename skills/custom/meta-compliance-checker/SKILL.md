---
name: meta-compliance-checker
description: Use before claiming task completion to enforce standards compliance through structured checklists and Ratchet tracking.
---

# Meta Compliance Checker (Standards Enforcement)

## Overview

本技能是机械化架构约束的执行层。它将 `docs/standards/` 中的原则性文档
转化为**结构化 checklist**，AI 必须在提交前逐项物理勾选，确保标准不是
"读过就忘"的建议，而是不可跳过的强制检查。

> **核心原则：如果 checklist 没有逐项勾选，任务不能标记为完成。**

---

## When to Use

**触发时机（满足任一）：**

- [ ] 任务涉及代码变更（CREATE / UPDATE / DELETE）
- [ ] 任务涉及新文档创建
- [ ] 任务涉及安全相关功能（auth、input handling、data storage）
- [ ] 任务涉及日志记录变更
- [ ] `meta-safe-executor` 审计阶段要求执行合规检查

**不触发的场景：**

- 纯 typo 修正（单字符变更）
- 已验证的自动化生成文件（如 CHANGELOG.md 自动更新）

---

## Checklist Library

### A. 安全标准预提交检查

**适用**：任何涉及用户输入、网络请求、文件操作、认证授权的变更。

```markdown
- [ ] **输入校验**：所有用户输入经过校验/转义（防止注入）
- [ ] **敏感信息**：无硬编码密钥、密码、令牌（检查源码中的 `password`, `secret`, `token`, `key`）
- [ ] **错误响应**：错误信息不暴露堆栈跟踪或内部路径
- [ ] **权限检查**：服务端执行权限校验（不信任客户端输入）
- [ ] **最小权限**：数据库/API 调用使用最小必要权限
```

### B. TDD 预提交检查

**适用**：任何涉及代码逻辑的变更。

```markdown
- [ ] **测试先行**：新功能有对应的测试（或已说明为何无需测试）
- [ ] **回归测试**：Bug 修复有回归测试（Red-Green-Refactor 验证）
- [ ] **测试通过**：`npm test` / `pytest` / 对应测试命令 exit 0
- [ ] **覆盖合理**：核心逻辑有测试覆盖（不要求 100%，但关键路径必须有）
```

### C. 日志标准预提交检查

**适用**：任何涉及日志记录的变更。

```markdown
- [ ] **级别正确**：日志级别符合标准（DEBUG/INFO/WARN/ERROR/FATAL）
- [ ] **无敏感信息**：日志中不包含密码、令牌、个人身份信息
- [ ] **结构化**：新增日志使用结构化格式（JSON key-value）而非纯文本拼接
- [ ] **上下文**：日志包含足够的排查信息（request_id、user_id 等）
```

### D. 文档结构预提交检查

**适用**：任何涉及 docs/ 目录的变更。

```markdown
- [ ] **文件名**：小写字母 + 数字 + 连字符，无空格
- [ ] **front matter**：handoff 文件包含 handoff_id，skill 文件包含 name/description
- [ ] **目录正确**：文件放在正确的分类目录下
```

---

## Ratchet Protocol（错误转化为永久规则）

### 记录格式

每次 AI 违反标准且被指出，必须在 `.project/compliance_log.md` 追加记录：

```markdown
| 时间 | 标准 | 违规描述 | 修复措施 | 状态 |
|------|------|---------|---------|------|
| 2026-05-28 | 安全-输入校验 | 未校验用户输入导致 XSS | 新增 checklist 项 + 代码修复 | ✅ Fixed |
```

### Ratchet 升级规则

| 违规次数 | 升级措施 |
|---------|---------|
| 第 1 次 | 记录日志，口头提醒 |
| 第 2 次 | 将对应 checklist 项标记为 **BLOCKING**（未勾选不能提交） |
| 第 3 次 | 将检查转化为 linter 规则（如果可自动化） |

---

## Integration with meta-safe-executor

`meta-safe-executor` 的审计流程应插入合规检查：

```text
meta-safe-executor workflow:
  1. Git Sentinel (backup)
  2. Semantic Logging (changelog)
  3. Safe Gate (destructive action check)
  4. ⬅️ NEW: Compliance Check (meta-compliance-checker)
     - 根据变更类型选择对应 checklist
     - AI 必须逐项勾选
     - 如果有 BLOCKING 项未勾选 → 拒绝提交
```

---

## Red Flags

- ❌ checklist 全部勾选但明显敷衍（如未读代码就勾选"输入校验"）
- ❌ 绕过 checklist 直接标记任务完成
- ❌ 同一标准连续违规 3 次但未转化为 linter 规则
- ❌ compliance_log.md 被清空或篡改

---


