---
name: common-uniapp-vue2
description: Domain Specialist for Uni-app (Vue 2 + TS) legacy projects, enforcing local rules.md and automating sub-package routing.
mode: step-by-step
---

# Uni-app Specialist (Domain Plugin)

## Overview
本技能是一个 **「领域插件」**，专门用于适配基于 Uni-app (Vue 2 + TS) 的 SOP1 遗留项目。它负责在执行过程中自动识别并对齐子库本地 `.ai/rules.md` 中的规约，减少手动检查分包路由和封装层的重复干预。

## Boundaries
- **本地规约优先**：所有逻辑执行必须首先读取子库的 `.ai/rules.md`。
- **自动对齐**：仅在检测到 `pages.js` 或 `pages.json` 时，自动尝试维护路由映射。

## The Stance
执行本技能时，AI 必须切换为 **「Uni-app 架构卫士」** 姿态：
- **拒绝非标准 API**：像洁癖一样检查所有 API 调用，确保它们都被封装层拦截。
- **物理路径敏感**：对页面存放位置（分包 vs 主包）进行严格物理检查。

## Implementation Workflow (Step-by-Step)

### 1. Pre-flight & Alignment (VCS Automation)
- [ ] **Issue & Branch Alignment**:
  - **ACTION**: 若未处于 Issue 分支，自动探测 GitHub Issue ID 并执行 `git checkout -b issue-N`。
  - **METADATA**: 在 `Proposal` 中自动记录 Issue 链接。
- [ ] **扫描本地规约**: 强制读取子库 `.ai/rules.md`，锁定 Uni-app 规约（分包、API 封装、Storage 约束）。

### 2. Implementation Loop (SOP1 Logic)
- [ ] **路由自动同步**: 识别页面存放位置（分包优先），自动更新 `src/pages.js`。
- [ ] **防御式编码**: 自动应用 `rules.md` 中的权限校验和 API 命名规范。

### 3. Verification & CI/CD Bridge
- [ ] **生成 AI PR Summary**: 准备符合 `ai_pr_summary.yml` 格式的变更总结。
- [ ] **元数据同步校验**: 确认 `.ai/archive/` 路径符合 SOP1 遗留同步脚本的要求。

### 4. Archive & Decision (Closing the Loop)
- [ ] **知识存回 Issue**: 准备用于 GitHub Action 自动关闭 Issue 的命令摘要。
- [ ] **ADR 自动固化**: 在归档时生成 `0XX-decision.md` 记录本次架构选择。

## Patterns & Anti-Patterns

### ✅ Pattern: 封装调用
**Before (SOP1 原始逻辑)**:
`if (!(await handleDeviceAuth(['scope.camera'])).state) return`
**After (SOP 2.0 自动注入)**:
AI 在生成方法体时，检测到相机调用，会自动前置该权限校验块，并正确导入工具类。

### ❌ Anti-Pattern: 逻辑泄漏
**错误做法**: 在页面中直接手写 `uni.showToast`。
**正确做法**: 必须使用 `popToast` 封装方法。
