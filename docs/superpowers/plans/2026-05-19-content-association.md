# 内容关联与侧边栏优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现内容的自动标签关联与侧边栏三级树状结构（标签->网页->标记）展示，解决信息过载问题。

**Architecture:** 
- 扩展数据模型支持 `tags` 字段。
- 实现 `AssociationEngine` 处理关键词聚类与晋升。
- 重构 `Sidepanel.vue` 的计算逻辑以支持虚拟文件夹展示。

**Tech Stack:** Vue 3, TypeScript, WebExtension Storage, Vitest.

---

### Task 1: 扩展数据模型与存储

**Files:**
- Modify: `src/logic/storage.ts`

- [x] **Step 1: 更新 `Mark` 接口并新增 `Tag` 接口**
- [x] **Step 2: 导出新的存储对象 `tagsMetadata`**
- [x] **Step 3: 提交变更**

---

### Task 2: 实现自动聚类逻辑 (Association Engine)

**Files:**
- Create: `src/logic/association.ts`
- Create: `src/tests/association.spec.ts`

- [x] **Step 1: 编写关键词提取与聚类算法的单元测试**
- [x] **Step 2: 实现 `AssociationEngine` 核心逻辑**
- [x] **Step 3: 运行测试并验证通过**
- [x] **Step 4: 提交变更**

---

### Task 3: 侧边栏重构 (三级树状结构)

**Files:**
- Modify: `src/sidepanel/Sidepanel.vue`

- [x] **Step 1: 重构 `structuredMarks` 计算属性**
- [x] **Step 2: 更新模板渲染逻辑**
- [x] **Step 3: 提交变更**

---

### Task 4: 交互与 Tooltip 增强

**Files:**
- Modify: `src/contentScripts/ui.ts`
- Modify: `src/logic/settings.ts`

- [x] **Step 1: 在设置中增加自动关联开关**
- [x] **Step 2: 更新 Tooltip 逻辑，在创建标记后显示关联结果或建议**
- [ ] **Step 3: 提交变更并完成最终验证**
