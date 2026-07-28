# 标签记忆（Tag Memory）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建标记时，Tooltip 自动预选上一次新建标记时选中的标签集合（空也记空），让批量整理长文到同一课题时无需反复点选。

**Architecture:** 在 `settings` 新增本地持久化字段 `lastUsedTags`；新建标记保存时（`createHighlight` 路径）写入；新建标记打开 Tooltip 时（`index.ts` 的 `ui.showTooltip`）作为 initialTags 传入；Tooltip.show() 内部用纯函数 `filterExistingTags` 过滤已删除标签的悬空 id。编辑已有标记路径完全不动。

**Tech Stack:** TypeScript, Vue 3, webext-bridge, Vitest

**Spec:** `docs/superpowers/specs/2026-07-28-tag-memory-default-design.md`

---

## 文件结构

| 文件 | 责任 | 操作 |
|---|---|---|
| `src/logic/tags.ts` | 标签工具纯函数（`filterExistingTags`） | 新建 |
| `src/tests/tags.spec.ts` | `filterExistingTags` 单测 | 新建 |
| `src/logic/settings.ts` | 用户偏好（新增 `lastUsedTags` 字段） | 修改 |
| `src/contentScripts/views/Tooltip.vue` | show() 内过滤悬空 id | 修改 |
| `src/contentScripts/index.ts` | 新建标记传 `lastUsedTags` 作为 initialTags | 修改 |
| `src/contentScripts/ui.ts` | `createHighlight` 保存后写入 `lastUsedTags` | 修改 |

---

## Task 1: `filterExistingTags` 纯函数（TDD，独立可提交）

**Files:**
- Create: `src/logic/tags.ts`
- Test: `src/tests/tags.spec.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/tests/tags.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { filterExistingTags } from '../logic/tags'
import type { Tag } from '../logic/storage'

function tag(id: string): Tag {
  return { id, name: id, color: '#000', createdAt: 0 }
}

describe('filterExistingTags', () => {
  it('保留 allTags 中现存的 id', () => {
    const all = [tag('a'), tag('b')]
    expect(filterExistingTags(['a', 'b'], all)).toEqual(['a', 'b'])
  })

  it('过滤掉已删除的悬空 id', () => {
    const all = [tag('a')]
    expect(filterExistingTags(['a', 'ghost'], all)).toEqual(['a'])
  })

  it('全部悬空时返回空数组', () => {
    const all = [tag('a')]
    expect(filterExistingTags(['x', 'y'], all)).toEqual([])
  })

  it('空输入返回空数组', () => {
    expect(filterExistingTags([], [tag('a')])).toEqual([])
  })

  it('保持原始顺序', () => {
    const all = [tag('a'), tag('b'), tag('c')]
    expect(filterExistingTags(['c', 'a', 'b'], all)).toEqual(['c', 'a', 'b'])
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/tests/tags.spec.ts`
Expected: FAIL — `filterExistingTags is not a function`（模块不存在）

- [ ] **Step 3: 创建最小实现**

创建 `src/logic/tags.ts`：

```ts
import type { Tag } from './storage'

/**
 * 过滤掉 allTags 中已不存在的标签 id（防悬空引用）。
 *
 * 用于标签记忆预选：`settings.lastUsedTags` 可能引用了之后被删除的标签，
 * 预选前需以此函数剔除，避免悬空 id 被写入新 mark 的 tags。
 */
export function filterExistingTags(ids: string[], allTags: Tag[]): string[] {
  const existingIds = new Set(allTags.map(t => t.id))
  return ids.filter(id => existingIds.has(id))
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/tests/tags.spec.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: lint 检查**

Run: `npx eslint src/logic/tags.ts src/tests/tags.spec.ts`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/logic/tags.ts src/tests/tags.spec.ts
git commit -m "feat(logic): add filterExistingTags utility for ghost-tag cleanup"
```

---

## Task 2: 接入 `lastUsedTags` 端到端（4 文件，一次性提交）

> 这些改动只有合在一起才有意义，单独提交会产生中间不可用状态，故作为一个提交。

**Files:**
- Modify: `src/logic/settings.ts`
- Modify: `src/contentScripts/views/Tooltip.vue:199`
- Modify: `src/contentScripts/index.ts:238`
- Modify: `src/contentScripts/ui.ts:402`

- [ ] **Step 1: settings.ts 新增字段**

在 `src/logic/settings.ts` 的 `defaultSettings` 末尾新增字段（`highlightHeight` 之后）：

```ts
export const defaultSettings = {
  defaultHighlightColor: '#FFFF00', // yellow
  highlightColors: [
    '#FFFF00', // yellow
    '#99FF99', // green
    '#FF9999', // red
    '#99CCFF', // blue
    '#FFCC99', // orange
  ],
  blacklist: [] as string[],
  shortcutSave: 'Alt+S',
  shortcutDelete: 'Alt+D',
  autoAssociation: true,
  highlightHeight: 5,
  lastUsedTags: [] as string[], // 上次新建标记时选中的标签 id（本地偏好，不同步）
}
```

- [ ] **Step 2: Tooltip.vue 过滤悬空 id**

在 `src/contentScripts/views/Tooltip.vue` 顶部 import 区（第 7 行 `import type { Tag }` 附近）加入：

```ts
import { filterExistingTags } from '../../logic/tags'
```

将 `show()` 中的第 199 行：

```ts
  selectedTags.value = [...initialTags]
```

改为：

```ts
  // 过滤掉已删除标签的悬空 id（lastUsedTags 或旧 mark.tags 可能引用已删除标签）
  selectedTags.value = filterExistingTags(initialTags, allTags.value)
```

（此时 `allTags.value` 已在 line 175-176 await 就绪，过滤安全。）

- [ ] **Step 3: index.ts 新建标记传 lastUsedTags**

`src/contentScripts/index.ts` 第 238 行，把 `ui.showTooltip(...)` 的第 7 个参数（tags）从 `[]` 改为 `settings.value.lastUsedTags`：

```ts
ui.showTooltip(event.clientX, event.clientY, false, '', settings.value.defaultHighlightColor, capturedText, settings.value.lastUsedTags)
```

（传原始未过滤值；过滤由 Tooltip.show() 内部统一处理，见 Step 2。）

- [ ] **Step 4: ui.ts 新建保存时写入 lastUsedTags**

在 `src/contentScripts/ui.ts` 的 `createHighlight` 方法末尾，`await sendMessage('add-mark', markData, 'background')`（第 402 行）之后追加一行：

```ts
    await sendMessage('add-mark', markData, 'background')
    // 记录本次新建标记选中的标签（含空集合），供下次新建时预选。仅新建分支，编辑分支不更新。
    settings.value.lastUsedTags = [...tags]
```

（`tags` 是 line 381 定义的 `const tags: string[] = [...manualTags]`，即本次实际写入 mark 的标签集合。）

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: 无与本次改动相关的新错误（预存错误照旧，但 settings/Tooltip/index/ui 这几个文件无新增报错）

- [ ] **Step 6: 构建**

Run: `npm run build:firefox`
Expected: exit 0

- [ ] **Step 7: lint**

Run: `npx eslint src/logic/settings.ts src/contentScripts/views/Tooltip.vue src/contentScripts/index.ts src/contentScripts/ui.ts`
Expected: 无新增错误（预存的 no-console 等不在本次改动行）

- [ ] **Step 8: 手动验证（加载构建产物到浏览器）**

按 Spec §7 的 4 个场景验证：
1. 新建标记选 [A,B] 保存 → 再新建标记 → Tooltip 应预选 A、B
2. 新建标记不选标签保存 → 再新建标记 → Tooltip 应无预选（记忆被清空）
3. 编辑一个有标签 C 的旧标记 → Tooltip 预选 C（**非** lastUsedTags）
4. 删除标签 A → 再新建标记 → A 不预选（悬空过滤生效）

- [ ] **Step 9: 提交**

```bash
git add src/logic/settings.ts src/contentScripts/views/Tooltip.vue src/contentScripts/index.ts src/contentScripts/ui.ts
git commit -m "feat(content): remember last-used tags and preselect on new mark

Preselect the tag set from the last newly-created mark when opening the
tooltip for the next new mark. Empty selection is also persisted, so
saving a new mark with no tags clears the memory.

- Add settings.lastUsedTags (local-only, not Gist-synced)
- Only the NEW-mark branch (createHighlight) updates the memory;
  editing existing marks keeps using the mark's own tags
- Ghost-tag ids filtered inside Tooltip.show() after allTags loads"
```

- [ ] **Step 10: 更新 ROADMAP（标记完成）+ 审计日志**

在 `docs/NIT_ROADMAP.md` §3 把"记忆上次使用的标签"条目的推荐等级从 `⭐⭐⭐⭐` 改为 `[已完成]`，评估理由简述落地方式。

在 `.project/ops_changelog.md` 追加一行审计记录。

```bash
git add docs/NIT_ROADMAP.md .project/ops_changelog.md
git commit -m "docs: mark tag-memory roadmap item done + audit log"
```

---

## 自检（Self-Review）

**Spec 覆盖**：
- §3 行为规则"新建预选" → Task 2 Step 3 + Step 2 ✅
- §3 "编辑不更新" → Task 2 Step 4（仅 createHighlight 分支）✅
- §3 "空也记空" → Task 2 Step 4（`[...tags]`，tags 可为空）✅
- §4 数据模型 → Task 2 Step 1 ✅
- §5 改动点 #1-#5 → Task 2 Step 1/2/3/4 + Task 1 ✅
- §6 边界（标签删除）→ Task 1（filterExistingTags）+ Task 2 Step 2 ✅
- §7 测试 → Task 1（单测）+ Task 2 Step 8（手动）✅
- §2 非目标（不同步/无清除按钮）→ 无需任务，约束已在实现中体现 ✅

**Placeholder 扫描**：无 TBD/TODO，每步含完整代码与命令。

**类型一致性**：`filterExistingTags(ids: string[], allTags: Tag[]): string[]` 在 Task 1 定义，Task 2 Step 2 调用处参数类型匹配（`initialTags: string[]`、`allTags.value: Tag[]`）。`lastUsedTags: string[]` 在 settings 定义，index.ts 传入与 ui.ts 写入均为 `string[]`。
