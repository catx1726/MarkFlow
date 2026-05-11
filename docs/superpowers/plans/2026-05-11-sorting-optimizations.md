# 侧边栏排序优化实施计划

> **对于代理工人：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐步实施此计划。步骤使用复选框 (`- [ ]`) 语法进行跟踪。

**目标：** 实现标记按文档物理位置排序，网页按最近活跃度排序。

**架构：**
1. **数据模型**：在 `Mark` 接口中添加 `domIndex`。
2. **位置捕获**：在内容脚本创建标记时，计算并存储其在文档中的字符偏移量。
3. **侧边栏排序**：在侧边栏计算属性中实现网页按最新活跃时间降序，标记按 `domIndex` 升序。

**技术栈：** Vue 3, TypeScript, Web Extension API, Vitest.

---

### 任务 1：更新数据模型

**文件：**
- 修改：`src/logic/storage.ts`

- [ ] **步骤 1：在 `Mark` 接口中添加 `domIndex` 字段**

```typescript
// src/logic/storage.ts
export interface Mark {
  // ... 其他字段
  domIndex?: number // 新增：用于物理位置排序
}
```

- [ ] **步骤 2：提交变更**

```bash
git add src/logic/storage.ts
git commit -m "chore: add domIndex to Mark interface"
```

---

### 任务 2：在内容脚本中捕获位置

**文件：**
- 修改：`src/contentScripts/ui.ts`

- [ ] **步骤 1：修改 `HighlightingApp.createMark` 方法**

需要在创建 `markData` 之前计算 `domIndex`。

```typescript
// src/contentScripts/ui.ts
// 找到 createMark 方法内部
const domIndex = DOMScanner.calculatePreciseOffset(rangyRange, document.body)

const markData: Mark = {
  // ... 其他字段
  domIndex,
}
```

- [ ] **步骤 2：提交变更**

```bash
git add src/contentScripts/ui.ts
git commit -m "feat: capture domIndex during mark creation"
```

---

### 任务 3：重构侧边栏排序逻辑

**文件：**
- 修改：`src/sidepanel/Sidepanel.vue`

- [ ] **步骤 1：修改 `structuredMarks` 计算属性**

实现网页按 `max(createdAt)` 降序，组内标记按 `domIndex` 升序。

```typescript
// src/sidepanel/Sidepanel.vue
  structuredMarks = computed(() => {
    const result: Record<string, { pageTitle: string; groups: MarkGroup[]; totalMarks: number }> = {}
    
    // 1. 提取所有 URL 及其最新活跃时间
    const sortedUrls = Object.entries(marksByUrl.value)
      .filter(([_, marks]) => marks && marks.length > 0)
      .map(([url, marks]) => ({
        url,
        lastActive: Math.max(...marks.map(m => m.createdAt))
      }))
      .sort((a, b) => b.lastActive - a.lastActive) // 网页按活跃度降序

    for (const { url } of sortedUrls) {
      const marks = marksByUrl.value[url]
      const pageTitle = getPageTitle(marks)
      const groups: Record<string, MarkGroup> = {}

      for (const mark of marks) {
        const contextTitle = mark.contextTitle || '未分类笔记',
          contextLevel = mark.contextLevel || 7,
          contextSelector = mark.contextSelector || 'body',
          contextOrder = mark.contextOrder ?? -1

        if (!groups[contextTitle]) {
          groups[contextTitle] = {
            title: contextTitle,
            level: contextLevel,
            selector: contextSelector,
            marks: [],
            count: 0,
            order: contextOrder
          }
        }
        groups[contextTitle].marks.push(mark)
      }

      // 按位置排序每个分组内的笔记
      for (const group of Object.values(groups)) {
        group.marks.sort((a, b) => {
          if (a.domIndex !== undefined && b.domIndex !== undefined)
            return a.domIndex - b.domIndex
          return a.createdAt - b.createdAt // 旧数据兼容
        })
        group.count = group.marks.length
      }

      const sortedGroups = Object.values(groups).sort((a, b) => a.order - b.order)
      result[url] = { pageTitle, groups: sortedGroups, totalMarks: marks.length }
    }
    return result
  })
```

- [ ] **步骤 2：提交变更**

```bash
git add src/sidepanel/Sidepanel.vue
git commit -m "feat: implement recency-based page sorting and position-based mark sorting"
```

---

### 任务 4：验证与测试

- [ ] **步骤 1：创建回归测试文件**

**文件：**
- 创建：`src/tests/sorting.spec.ts`

```typescript
import { describe, it, expect } from 'vitest'
// 模拟数据并验证排序逻辑（如果逻辑已抽离）或通过 UI 测试验证
```

- [ ] **步骤 2：手动验证**
1. 在网页 A 底部添加标记。
2. 在网页 A 顶部添加标记。
3. 检查侧边栏，顶部标记应排在前面。
4. 在网页 B 添加标记。
5. 检查侧边栏，网页 B 应排在网页 A 前面。

- [ ] **步骤 3：提交测试文件**

```bash
git add src/tests/sorting.spec.ts
git commit -m "test: add sorting verification tests"
```
