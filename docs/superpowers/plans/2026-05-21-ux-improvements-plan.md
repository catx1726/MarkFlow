# UX 交互优化与 Markdown 导出降级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化侧边栏文件夹交互为互斥手风琴，增加数量徽章与空状态视觉提示，并重构 Markdown 导出为不破坏大纲结构的“可嵌入片段”格式。

**Architecture:** 
1. **逻辑层**：更新 `TagTree` 数据结构，在文件夹级别预计算 `totalMarks`。
2. **表现层**：利用 Chrome 120+ 原生 `<details name="...">` 实现零 JS 互斥交互，通过 CSS 变量与 Tailwind 类名处理置灰与徽章。
3. **导出层**：重写导出模板，将 `#` 标题降级为 `> 引用` 和 `**加粗**` 文本。

**Tech Stack:** Vue 3, Vite, Tailwind CSS (UnoCSS), Turndown.

---

### Task 1: 逻辑层 - 预计算文件夹级别的标记总数

**Files:**
- Modify: `src/logic/tagTree.ts`
- Test: `src/tests/metadata.spec.ts`

- [ ] **Step 1: 更新 TagTree 接口定义**
在 `TagTree` 的文件夹级别增加 `totalMarks` 字段。

```typescript
// src/logic/tagTree.ts
export interface TagTree {
  [tagId: string]: {
    tagName: string
    totalMarks: number // 新增
    pages: Record<string, {
      pageTitle: string
      groups: MarkGroup[]
      totalMarks: number
    }>
  }
}
```

- [ ] **Step 2: 编写失败的单元测试**
在现有测试中增加对文件夹级别 `totalMarks` 的断言。

```typescript
// src/tests/metadata.spec.ts
// ... 找到测试 buildTagTree 的地方，添加：
expect(tree.inbox.totalMarks).toBe(2) 
```

- [ ] **Step 3: 实现 buildTagTree 逻辑更新**

```typescript
// src/logic/tagTree.ts
// 在初始化 tree 时：
const tree: TagTree = {
  inbox: { tagName: '收集箱 (Inbox)', totalMarks: 0, pages: {} }
}
// 在 Object.values(tagsMetadata).forEach 循环中：
tree[tag.id] = { tagName: tag.name, totalMarks: 0, pages: {} }

// 在累加 pageEntry.totalMarks 的地方同时累加：
tree[actualTagId].totalMarks++
```

- [ ] **Step 4: 运行测试并验证通过**
Run: `npm test src/tests/metadata.spec.ts`

- [ ] **Step 5: Commit**
```bash
git add src/logic/tagTree.ts src/tests/metadata.spec.ts
git commit -m "feat: pre-calculate totalMarks at folder level in TagTree"
```

---

### Task 2: 表现层 - 互斥手风琴与 UI 视觉优化

**Files:**
- Modify: `src/sidepanel/Sidepanel.vue`

- [ ] **Step 1: 替换文件夹容器为 <details>**
删除旧的 `toggleFolder` JS 逻辑触发器，改用原生属性。

```html
<!-- src/sidepanel/Sidepanel.vue -->
<details 
  v-for="[tagId, folder] in Object.entries(structuredMarks)" 
  :key="tagId" 
  name="tag-folder"
  :open="tagId === 'inbox'"
  class="mb-6 shadow-sm group/folder"
>
  <summary 
    class="flex items-center gap-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-t-lg cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-700 list-none"
    :class="{ 'opacity-50 grayscale': folder.totalMarks === 0 }"
  >
    <!-- 替换原有的展开/收起图标逻辑 -->
    <svg class="h-5 w-5 text-gray-500 transition-transform group-open/folder:rotate-0 rotate-[-90deg]">...</svg>
    <span class="font-bold text-gray-700 dark:text-gray-200 flex-1">{{ folder.tagName }}</span>
    <!-- 数量徽章 -->
    <span class="px-2 py-0.5 text-xs font-semibold bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full">
      {{ folder.totalMarks }}
    </span>
  </summary>
  <!-- 原有的内容部分移入此处 -->
</details>
```

- [ ] **Step 2: 移除已废弃的 JS 状态**
移除 `collapsedFolders` 及其相关方法（`toggleFolder`, `isFolderCollapsed`），因为现在由浏览器处理。

- [ ] **Step 3: 视觉微调**
确保 `<summary>` 默认不显示系统小箭头（使用 `list-none` 或 `::-webkit-details-marker { display: none }`）。

- [ ] **Step 4: Commit**
```bash
git add src/sidepanel/Sidepanel.vue
git commit -m "feat: implement native mutual-exclusion accordion and count badges"
```

---

### Task 3: 导出层 - Markdown 模板重构

**Files:**
- Modify: `src/sidepanel/Sidepanel.vue`

- [ ] **Step 1: 更新 exportToMarkdown (单页导出)**

```typescript
// src/sidepanel/Sidepanel.vue
function exportToMarkdown(urlData: { pageTitle: string; groups: MarkGroup[] }) {
  // ...
  let markdown = `> 来源：[${pageTitle}](${pageURL})\n\n---\n\n` // 降级 H1
  for (const group of groups) {
    markdown += `**${group.title}**\n\n` // 降级 H2+
    for (const mark of group.marks) {
      // ... 保持 > 内容 ...
      if (mark.note) markdown += `**备注**：${mark.note}\n\n`
      markdown += `---\n\n` // 统一分隔符
    }
  }
  // ...
}
```

- [ ] **Step 2: 更新 exportTagFolder (整标签导出)**

```typescript
// src/sidepanel/Sidepanel.vue
function exportTagFolder(folder: { tagName: string; pages: Record<string, any> }) {
  let markdown = `**标签：${folder.tagName}**\n\n---\n\n` // 降级 H1
  for (const [url, urlData] of Object.entries(folder.pages)) {
    const { pageTitle, groups } = urlData as any
    markdown += `**[${pageTitle}](${url})**\n\n` // 降级 H2
    for (const group of groups) {
      markdown += `*${group.title}*\n\n` // 降级 H3+ 为斜体
      for (const mark of group.marks) {
        // ... 逻辑同上 ...
      }
    }
    markdown += `---\n\n`
  }
  // ...
}
```

- [ ] **Step 3: 手动验证导出格式**
导出一个包含多个标记的页面，检查 Markdown 内容。

- [ ] **Step 4: Commit**
```bash
git add src/sidepanel/Sidepanel.vue
git commit -m "feat: downgrade markdown export headers for better embedding"
```
