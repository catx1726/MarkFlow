# 🚀 跨元素高亮恢复实现计划 (Cross-Element Restoration Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决高亮跨越多个 DOM 元素（如多个 `<p>` 或 `<div>`）时，搜索算法定位不准及恢复弹窗内容截断的问题。

**Architecture:** 
1. 搜索时识别匹配文本覆盖的所有文本节点。
2. 计算这些节点的最小公共祖先 (LCA) 作为候选容器。
3. 重构高亮应用逻辑，支持跨文本节点边界重建 Range。

**Tech Stack:** TypeScript, Rangy, Vue 3

---

### Task 1: 增强文本节点遍历与 Candidate 接口

**Files:**
- Modify: `src/logic/search.ts`
- Test: `src/tests/search.spec.ts`

- [x] **Step 1: 更新 `Candidate` 接口，明确基准坐标**
- [x] **Step 2: 编写测试用例验证跨元素文本提取**
- [x] **Step 3: 运行测试并提交**

---

### Task 2: 实现最小公共祖先 (LCA) 定位工具

**Files:**
- Modify: `src/logic/dom.ts`
- Test: `src/tests/metadata.spec.ts`

- [x] **Step 1: 实现 `findCommonAncestor` 函数**
- [x] **Step 2: 验证工具函数**
- [x] **Step 3: 提交**

---

### Task 3: 重构搜索算法支持跨元素候选者

**Files:**
- Modify: `src/logic/search.ts`

- [x] **Step 1: 修改 `createCandidate` 以支持多节点跨度**
- [x] **Step 2: 运行现有测试确保不破坏单元素匹配**
- [x] **Step 3: 提交**

---

### Task 4: 增强高亮应用逻辑以支持跨节点 Range

**Files:**
- Modify: `src/contentScripts/index.ts`

- [x] **Step 1: 重构 `applyPreciseHighlight` 以支持跨 TextNode 边界**
- [x] **Step 2: 物理验证跨元素选择后的恢复**
- [x] **Step 3: 提交**

---

### Task 5: 优化恢复持久性与标记进化 (Persistence & Self-healing)

**Files:**
- Modify: `src/contentScripts/index.ts`
- Modify: `src/background/main.ts`

- [x] **Step 1: 修复恢复确认后刷新仍弹窗的问题**
  - 在手动确认/自动恢复后，将最新的 `text`, `html`, `rangySerialized` 及上下文更新至后台。
  - 确保数据写入 `browser.storage.local`（Vue 响应式强制触发）。
- [x] **Step 2: 引入“标记进化”机制**
  - 当页面发生内容删除导致歧义时，恢复后的标记将“记忆”当前短文本，作为新的 Level 1 判定标准。
- [x] **Step 3: 提交**

---

### Task 6: 最终集成测试与文档更新

**Files:**
- Create: `src/tests/cross-element.spec.ts`
- Create: `src/tests/repro_issue.spec.ts`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [x] **Step 1: 编写完整的集成测试**
- [x] **Step 2: 更新 CHANGELOG**
- [x] **Step 3: 更新设计规范中的自愈机制**
- [x] **Step 4: 提交**
