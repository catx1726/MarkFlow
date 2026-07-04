# 侧边栏搜索功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 MarkFlow 侧边栏增加常驻搜索框，支持按关键词过滤 tag/page/mark，命中后保留完整 page 上下文；同时把新建标签折叠为 "+" 按钮。

**Architecture:** 在 `SidepanelHeader.vue` 增加搜索框和折叠的新建标签输入区；`useTagActions.ts` 管理新建标签展开状态；`useSidepanelData.ts` 暴露基于 `searchQuery` 的 `filteredTree` 计算属性；`Sidepanel.vue` 负责串联搜索状态和渲染过滤后的树。

**Tech Stack:** Vue 3, TypeScript, Tailwind CSS, Vitest, webext-bridge

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/sidepanel/components/SidepanelHeader.vue` | 渲染搜索框、清除按钮、折叠的新建标签输入区、设置按钮 |
| `src/sidepanel/composables/useTagActions.ts` | 新增 `isCreatingTag` 状态，管理新建标签展开/收起/聚焦 |
| `src/sidepanel/composables/useSidepanelData.ts` | 新增 `searchQuery` 与 `filteredTree`，实现过滤逻辑与防抖 |
| `src/sidepanel/Sidepanel.vue` | 绑定搜索状态，传递 `filteredTree` 给 `TagFolder.vue`，渲染搜索空状态 |
| `src/sidepanel/composables/__tests__/useSidepanelData.spec.ts` | 覆盖过滤函数行为 |

---

## Task 1: 在 `useTagActions.ts` 中管理新建标签折叠状态

**Files:**
- Modify: `src/sidepanel/composables/useTagActions.ts`
- Test: `src/sidepanel/composables/__tests__/useTagActions.spec.ts`（已有文件，追加用例）

- [ ] **Step 1: 新增状态与方法**

在 `useTagActions` 中新增：

```typescript
import { nextTick, ref, toRaw } from 'vue'

export function useTagActions() {
  const newTagName = ref('')
  const isCreatingTag = ref(false)
  const tagInputRef = ref<HTMLInputElement | null>(null)
  // ... existing refs

  async function createTag() {
    if (!newTagName.value.trim())
      return
    await sendMessage('create-tag', { name: newTagName.value.trim() }, 'background')
    newTagName.value = ''
    isCreatingTag.value = false
  }

  function startCreatingTag() {
    isCreatingTag.value = true
    nextTick(() => tagInputRef.value?.focus())
  }

  function cancelCreatingTag() {
    if (!newTagName.value.trim())
      isCreatingTag.value = false
  }

  // ... existing functions

  return {
    newTagName,
    isCreatingTag,
    tagInputRef,
    createTag,
    startCreatingTag,
    cancelCreatingTag,
    // ... existing returns
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/sidepanel/composables/useTagActions.ts
git commit -m "feat(tag-actions): add collapsible create-tag state"
```

---

## Task 2: 在 `useSidepanelData.ts` 中实现搜索过滤

**Files:**
- Modify: `src/sidepanel/composables/useSidepanelData.ts`
- Test: `src/sidepanel/composables/__tests__/useSidepanelData.spec.ts`

- [ ] **Step 1: 新增 `filterTagTree` 纯函数（先写测试）**

在 `src/sidepanel/composables/__tests__/useSidepanelData.spec.ts` 中追加测试：

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useSidepanelData } from '../useSidepanelData'
import { marksByUrl, tagsMetadata } from '~/logic/storage'
import { filterTagTree } from '../useSidepanelData'
import type { Mark, Tag } from '~/logic/storage'
import type { TagTree } from '~/logic/tagTree'

// ... existing mocks and tests

function buildSampleTree(): TagTree {
  const markA: Mark = {
    id: 'a',
    text: 'hello world',
    html: '<mark>hello world</mark>',
    url: 'https://example.com/page-a',
    title: 'Page A',
    createdAt: 1,
    tags: ['tag1'],
  } as Mark

  const markB: Mark = {
    id: 'b',
    text: 'another note',
    html: '<mark>another note</mark>',
    url: 'https://example.com/page-b',
    title: 'Page B',
    createdAt: 2,
    tags: ['tag2'],
  } as Mark

  return {
    tag1: { tagName: 'Tag One', totalMarks: 1, pages: {
      'https://example.com/page-a': { pageTitle: 'Page A', groups: [{
        title: 'Group A', level: 7, selector: 'body', marks: [markA], count: 1, order: 0,
      }], totalMarks: 1 },
    }},
    tag2: { tagName: 'Tag Two', totalMarks: 1, pages: {
      'https://example.com/page-b': { pageTitle: 'Page B', groups: [{
        title: 'Group B', level: 7, selector: 'body', marks: [markB], count: 1, order: 0,
      }], totalMarks: 1 },
    }},
  }
}

describe('filterTagTree', () => {
  it('returns full tree when query is empty', () => {
    const tree = buildSampleTree()
    expect(filterTagTree(tree, '')).toEqual(tree)
  })

  it('keeps entire page when a mark matches', () => {
    const tree = buildSampleTree()
    const result = filterTagTree(tree, 'hello')
    expect(result).toHaveProperty('tag1')
    expect(result).not.toHaveProperty('tag2')
    expect(result.tag1.pages['https://example.com/page-a'].groups[0].marks).toHaveLength(1)
  })

  it('matches page title', () => {
    const tree = buildSampleTree()
    const result = filterTagTree(tree, 'page b')
    expect(result).toHaveProperty('tag2')
    expect(result).not.toHaveProperty('tag1')
  })

  it('matches tag name', () => {
    const tree = buildSampleTree()
    const result = filterTagTree(tree, 'one')
    expect(result).toHaveProperty('tag1')
    expect(result).not.toHaveProperty('tag2')
  })

  it('uses AND for multiple terms', () => {
    const tree = buildSampleTree()
    const result = filterTagTree(tree, 'hello another')
    expect(Object.keys(result).length).toBe(0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/sidepanel/composables/__tests__/useSidepanelData.spec.ts
```

Expected: FAIL - `filterTagTree` not defined

- [ ] **Step 3: 实现 `filterTagTree` 并集成到 composable**

在 `src/sidepanel/composables/useSidepanelData.ts` 中修改：

```typescript
import { type TagTree, buildTagTree } from '~/logic/tagTree'
import type { Mark } from '~/logic/storage'
import { useDebounceFn } from '@vueuse/core'

export function isMarkMatch(mark: Mark, terms: string[]): boolean {
  const haystack = [
    mark.text,
    mark.html,
    mark.note,
    mark.title,
    mark.url,
    mark.contextTitle,
  ].filter(Boolean).join(' ').toLowerCase()
  return terms.every(term => haystack.includes(term))
}

export function filterTagTree(tree: TagTree, query: string): TagTree {
  const rawQuery = query.trim()
  if (!rawQuery)
    return tree

  const terms = rawQuery.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0)
    return tree

  const result: TagTree = {}

  for (const [tagId, folder] of Object.entries(tree)) {
    const tagNameMatch = terms.every(term => folder.tagName.toLowerCase().includes(term))
    const matchedPages: typeof folder.pages = {}

    for (const [url, page] of Object.entries(folder.pages)) {
      const pageTitleMatch = terms.every(term => page.pageTitle.toLowerCase().includes(term))
      const matchedGroups = page.groups.map((group) => {
        const groupTitleMatch = terms.every(term => group.title.toLowerCase().includes(term))
        const matchedMarks = group.marks.filter(mark =>
          groupTitleMatch || isMarkMatch(mark, terms),
        )
        return { ...group, marks: matchedMarks, count: matchedMarks.length }
      }).filter(group => group.marks.length > 0)

      if (pageTitleMatch || matchedGroups.length > 0 || tagNameMatch) {
        matchedPages[url] = pageTitleMatch || tagNameMatch
          ? page
          : { ...page, groups: matchedGroups, totalMarks: matchedGroups.reduce((sum, g) => sum + g.count, 0) }
      }
    }

    if (Object.keys(matchedPages).length > 0) {
      result[tagId] = {
        ...folder,
        pages: matchedPages,
        totalMarks: Object.values(matchedPages).reduce((sum, p) => sum + p.totalMarks, 0),
      }
    }
  }

  return result
}

export function useSidepanelData() {
  const structuredMarks = ref<TagTree>({ inbox: { tagName: '收集箱 (Inbox)', totalMarks: 0, pages: {} } })
  const searchQuery = ref('')
  const isSidepanelActive = ref(true)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const debouncedSetSearchQuery = useDebounceFn((value: string) => {
    searchQuery.value = value
  }, 150)

  const filteredTree = computed(() => filterTagTree(structuredMarks.value, searchQuery.value))

  // ... existing refreshAllMarks and watch

  return {
    structuredMarks,
    searchQuery,
    setSearchQuery: debouncedSetSearchQuery,
    filteredTree,
    refreshAllMarks,
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/sidepanel/composables/__tests__/useSidepanelData.spec.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/sidepanel/composables/useSidepanelData.ts src/sidepanel/composables/__tests__/useSidepanelData.spec.ts
git commit -m "feat(sidepanel-data): add search filter and debounced query"
```

---

## Task 3: 重构 `SidepanelHeader.vue`

**Files:**
- Modify: `src/sidepanel/components/SidepanelHeader.vue`

- [ ] **Step 1: 更新 props/emits 和模板**

```vue
<script setup lang="ts">
defineProps<{
  newTagName: string
  isCreatingTag: boolean
  searchQuery: string
}>()

const emit = defineEmits<{
  (e: 'update:newTagName', value: string): void
  (e: 'create-tag'): void
  (e: 'open-options'): void
  (e: 'update:searchQuery', value: string): void
  (e: 'start-creating-tag'): void
  (e: 'cancel-creating-tag'): void
}>()

function clearSearch() {
  emit('update:searchQuery', '')
}
</script>

<template>
  <header class="sticky top-0 z-40">
    <h1 class="text-xl font-bold text-center text-gray-800 dark:text-gray-200 mt-4 mb-2">
      标记管理
    </h1>

    <div class="px-2 space-y-2">
      <div
        class="flex gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"
      >
        <div class="relative flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            :value="searchQuery"
            type="search"
            placeholder="搜索标记、页面或标签..."
            class="w-full pl-9 pr-8 py-1.5 text-sm rounded-md border border-gray-200 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            @input="e => emit('update:searchQuery', (e.target as HTMLInputElement).value)"
          >
          <button
            v-if="searchQuery"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            @click="clearSearch"
          >
            ✕
          </button>
        </div>

        <button
          class="p-1.5 rounded-md transition-colors"
          :class="isCreatingTag ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'"
          title="新建标签"
          @click="emit(isCreatingTag ? 'cancel-creating-tag' : 'start-creating-tag')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <button
          class="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="打开设置"
          @click="emit('open-options')"
        >
          <!-- existing settings svg -->
        </button>
      </div>

      <div
        v-if="isCreatingTag"
        class="flex gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"
      >
        <input
          :value="newTagName"
          placeholder="新建标签..."
          class="border-gray-200 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 flex-1 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
          @input="e => emit('update:newTagName', (e.target as HTMLInputElement).value)"
          @keydown.enter="emit('create-tag')"
          @keydown.esc="emit('cancel-creating-tag')"
        >
        <button
          class="bg-blue-600 hover:bg-blue-700 rounded-md px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors"
          @click="emit('create-tag')"
        >
          创建
        </button>
      </div>
    </div>
  </header>
</template>
```

- [ ] **Step 2: 运行 lint/type-check（如项目有）**

```bash
corepack pnpm typecheck || true
```

- [ ] **Step 3: 提交**

```bash
git add src/sidepanel/components/SidepanelHeader.vue
git commit -m "feat(sidepanel-header): add search input and collapse create-tag"
```

---

## Task 4: 在 `Sidepanel.vue` 中串联搜索状态与过滤树

**Files:**
- Modify: `src/sidepanel/Sidepanel.vue`

- [ ] **Step 1: 更新 composable 解构和事件处理**

```typescript
const { structuredMarks, searchQuery, setSearchQuery, filteredTree, refreshAllMarks } = useSidepanelData()

const {
  newTagName,
  isCreatingTag,
  tagInputRef,
  createTag,
  startCreatingTag,
  cancelCreatingTag,
  // ... rest
} = useTagActions()

function handleSearchInput(value: string) {
  setSearchQuery(value)
}

function clearSearch() {
  searchQuery.value = ''
}
```

- [ ] **Step 2: 更新模板绑定**

```vue
<SidepanelHeader
  v-model:new-tag-name="newTagName"
  v-model:search-query="searchQuery"
  :is-creating-tag="isCreatingTag"
  @create-tag="createTag"
  @open-options="handleOpenOptions"
  @start-creating-tag="startCreatingTag"
  @cancel-creating-tag="cancelCreatingTag"
  @update:search-query="handleSearchInput"
/>
```

- [ ] **Step 3: 渲染过滤后的树和空状态**

```vue
<div v-else class="space-y-6">
  <TagFolder
    v-for="[tagId, folder] in Object.entries(filteredTree)"
    :key="tagId"
    :tag-id="tagId"
    :folder="folder"
    <!-- ... existing props and events -->
  />

  <div
    v-if="Object.keys(filteredTree).length === 0 && searchQuery.trim()"
    class="text-center text-gray-500 py-8"
  >
    <p>未找到包含「{{ searchQuery }}」的标记</p>
    <button
      class="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      @click="clearSearch"
    >
      清除搜索
    </button>
  </div>
</div>
```

- [ ] **Step 4: 运行构建**

```bash
corepack pnpm build
```

Expected: exit 0

- [ ] **Step 5: 提交**

```bash
git add src/sidepanel/Sidepanel.vue
git commit -m "feat(sidepanel): wire search state and render filtered tree"
```

---

## Task 5: 端到端验证

- [ ] **Step 1: 运行所有相关测试**

```bash
npx vitest run src/sidepanel
```

Expected: PASS

- [ ] **Step 2: 手动检查清单**

- 侧边栏顶部出现搜索框和 "+" 按钮。
- 点击 "+" 展开新建标签输入框，自动聚焦。
- 输入标签名并按 Enter 或点击创建，成功后收起。
- 搜索关键词后，仅显示命中的 tag/page，同页其他 mark 保留。
- 清除搜索后恢复完整树。
- 无结果时显示提示和"清除搜索"按钮。

- [ ] **Step 3: 最终提交（如仅文档/测试调整）**

```bash
git add -A
git commit -m "test(sidepanel): verify search and collapsible create-tag"
```

---

## Spec Coverage Check

| Spec Requirement | Implementing Task |
|------------------|-------------------|
| 搜索框常驻于 `SidepanelHeader` | Task 3 |
| 新建标签折叠为 "+" 按钮 | Task 1 + Task 3 |
| 命中后保留完整 page | Task 2 (`filterTagTree`) |
| 多关键词 AND 匹配 | Task 2 |
| 搜索防抖 150ms | Task 2 (`useDebounceFn`) |
| 空状态提示 + 清除按钮 | Task 4 |
| 单元测试覆盖过滤 | Task 2 |

## Placeholder Scan

- 无 TBD/TODO。
- 所有代码步骤包含完整代码片段。
- 测试步骤包含完整测试用例。
- 文件路径均为绝对路径。

## Type Consistency

- `searchQuery` 在 `useSidepanelData`、`SidepanelHeader` props、`Sidepanel.vue` 中统一为 `string`/`Ref<string>`。
- `isCreatingTag` 在 `useTagActions`、props、`Sidepanel.vue` 中统一为 `boolean`/`Ref<boolean>`。
- `filteredTree` 类型为 `ComputedRef<TagTree>`。
