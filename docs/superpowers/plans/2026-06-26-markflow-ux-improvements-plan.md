# MarkFlow 恢复算法简化与标记样式自定义 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 跳过 Level 3/4 恢复算法，将恢复失败状态持久化并在侧边栏提示上下文；同时增加高亮高度自定义与等值 padding-bottom 边距控制。

**Architecture:** 通过最小化条件控制暂时停用共识重构与歧义弹窗；在 `Mark` 中新增 `restoreFailedAt` 字段记录失败时间；`MarkItem.vue` 根据该字段显示上下文提示。高亮样式由 `highlightDefaultStyle(color, height)` 统一生成，并在设置页暴露 `highlightHeight` 滑块。

**Tech Stack:** Vue 3, TypeScript, webext-bridge, webextension-polyfill, Vitest, UnoCSS, Rangy

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/logic/storage.ts` | 新增 `Mark.restoreFailedAt?: number` |
| `src/logic/search.ts` | 从策略数组中移除 `ConsensusMatchStrategy`，保留类定义 |
| `src/logic/config.ts` | `highlightDefaultStyle` 增加 `height` 参数 |
| `src/logic/settings.ts` | 新增 `highlightHeight: 5` 默认值 |
| `src/contentScripts/restorer.ts` | 恢复失败时写入 `restoreFailedAt`；移除歧义队列写入；`scrollToMark` 使用 `highlightHeight` |
| `src/contentScripts/index.ts` | 阻止歧义弹窗触发；预览高亮使用 `highlightHeight` |
| `src/contentScripts/ui.ts` | 创建/更新高亮时使用 `highlightHeight`；保留弹窗组件但不触发 |
| `src/options/Options.vue` | 新增高度设置 UI；保存后广播刷新 |
| `src/sidepanel/components/MarkItem.vue` | 根据 `restoreFailedAt` 显示上下文提示 |
| `src/tests/search.spec.ts` | 移除/跳过依赖共识策略的测试 |
| `src/tests/restorer.spec.ts` | 更新/新增恢复失败状态测试 |

---

## Task 1: Mark 模型新增恢复失败字段

**Files:**
- Modify: `src/logic/storage.ts:54-73`

- [ ] **Step 1: 添加 `restoreFailedAt` 字段**

```typescript
export interface Mark {
  id: string
  url: string
  text: string
  note: string
  color: string
  html?: string
  rangySerialized: string
  shadowHostSelector?: string
  createdAt: number
  title?: string
  domIndex?: number
  tags?: string[]
  contextTitle?: string
  contextLevel?: number
  contextSelector?: string
  contextOrder?: number
  surroundingSnippet?: string
  deletedAt?: number
  restoreFailedAt?: number // 新增：最近一次恢复失败时间戳
}
```

- [ ] **Step 2: Commit**

```bash
git add src/logic/storage.ts
git commit -m "feat(storage): add restoreFailedAt field to Mark model"
```

---

## Task 2: 跳过 Level 3 共识搜索策略

**Files:**
- Modify: `src/logic/search.ts:249-269`

- [ ] **Step 1: 修改 `findCandidateElements` 策略数组**

将策略数组从：

```typescript
const strategies: SearchStrategy[] = [new ExactMatchStrategy(), new RegexMatchStrategy(), new ConsensusMatchStrategy()]
```

改为：

```typescript
const strategies: SearchStrategy[] = [new ExactMatchStrategy(), new RegexMatchStrategy()]
```

保留 `ConsensusMatchStrategy`、`ConsensusAnchorManager`、`LocalAligner` 类定义不动。

- [ ] **Step 2: Commit**

```bash
git add src/logic/search.ts
git commit -m "feat(search): skip Level 3 consensus strategy while keeping class definitions"
```

---

## Task 3: 阻止歧义弹窗触发

**Files:**
- Modify: `src/contentScripts/index.ts:69-76`

- [ ] **Step 1: 注释掉或短路弹窗触发逻辑**

将：

```typescript
const ambiguous = await restorer.restoreHighlights()
if (ambiguous.length > 0 && !state.modalState.visible) {
  setTimeout(() => {
    if (state.ambiguousMarksQueue.value.length > 0 && !state.modalState.visible) {
      state.disambiguationModalApp?.show(state.ambiguousMarksQueue.value)
    }
  }, 1000)
}
```

改为：

```typescript
await restorer.restoreHighlights()
// Level 4 disambiguation UI is intentionally skipped (SPEC-2026-06-26-001).
// Future restoration: check restorer.restoreHighlights() return value and show modal here.
```

- [ ] **Step 2: Commit**

```bash
git add src/contentScripts/index.ts
git commit -m "feat(content): skip disambiguation modal trigger"
```

---

## Task 4: 恢复失败时写入 `restoreFailedAt`

**Files:**
- Modify: `src/contentScripts/restorer.ts:115-134`, `168-255`

- [ ] **Step 1: 简化 `applyMarksTwoPhases` 第二阶段**

将第二阶段循环中的：

```typescript
const result = await this.restoreBySearch(mark)
if (!result.success && result.candidates) {
  this.state.addToAmbiguousQueue(result.candidates)
}
```

改为：

```typescript
const success = await this.restoreBySearch(mark)
if (!success) {
  await sendMessage('update-mark-details', {
    id: mark.id,
    url: mark.url,
    restoreFailedAt: Date.now(),
  } as any, 'background')
}
```

- [ ] **Step 2: 修改 `restoreBySearch` 返回类型为 `Promise<boolean>`**

将 `SearchRestoreResult` 接口和 `restoreBySearch` 返回值从 `{ success: boolean, candidates?: Candidate[] }` 改为 `Promise<boolean>`。

简化后的核心分支：

```typescript
private async restoreBySearch(mark: Mark): Promise<boolean> {
  // ... existing setup unchanged ...
  let { ambiguityLevel, candidates } = findCandidateElements(mark, root, 10)

  if (candidates.length === 0 && root !== document.documentElement) {
    const globalResult = findCandidateElements(mark, document.documentElement, 10)
    ambiguityLevel = globalResult.ambiguityLevel
    candidates = globalResult.candidates
  }

  if (ambiguityLevel === 'unique' && candidates.length === 1) {
    const candidate = candidates[0]
    const similarity = mark.surroundingSnippet
      ? calculateSimilarity(candidate.surroundingSnippet, mark.surroundingSnippet)
      : 100

    if (similarity >= L3_SIMILARITY_THRESHOLD) {
      const rangeResult = applyPreciseHighlight(
        candidate.candidateElement,
        candidate.displayTextSnippet,
        applier,
        candidate.matchIndex,
      )
      if (rangeResult) {
        // ... success logic (keep existing) ...
        // On success, clear restoreFailedAt
        await sendMessage('update-mark-details', {
          id: mark.id,
          url: mark.url,
          restoreFailedAt: null,
        } as any, 'background')
        return true
      }
    }
  }
  return false
}
```

保留成功时的路径更新逻辑，但不再更新 `domIndex` 等元数据（避免页面大幅变化时写入错误数据）。如果当前代码中有自动更新 `rangySerialized` 的逻辑，建议保留，因为它是基于成功恢复的 range，是安全的。

- [ ] **Step 3: Commit**

```bash
git add src/contentScripts/restorer.ts
git commit -m "feat(restorer): write restoreFailedAt on failure, simplify return type"
```

---

## Task 5: 侧边栏 MarkItem 显示上下文提示

**Files:**
- Modify: `src/sidepanel/components/MarkItem.vue`

- [ ] **Step 1: 新增本地展开状态与辅助数据**

在 `<script setup>` 中新增：

```typescript
import { computed, nextTick, ref, watch } from 'vue'

const showContext = ref(false)

const hasContext = computed(() => !!props.mark.contextTitle || !!props.mark.surroundingSnippet)
const contextHint = computed(() => {
  if (!props.mark.restoreFailedAt) return ''
  return '原位置已变化'
})
```

- [ ] **Step 2: 在模板中增加提示徽章和上下文展开区**

在 `<div class="min-w-0 flex-1">` 内部、标记文本之后插入：

```vue
<div v-if="mark.restoreFailedAt && hasContext" class="mt-1">
  <button
    class="text-xs flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline"
    @click.stop="showContext = !showContext"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
    </svg>
    {{ contextHint }}
  </button>
  <div v-if="showContext" class="mt-1.5 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-gray-600 dark:text-gray-300">
    <p v-if="mark.contextTitle" class="font-medium mb-1">
      章节：{{ mark.contextTitle }}
    </p>
    <p v-if="mark.surroundingSnippet" class="italic">
      “{{ mark.surroundingSnippet }}”
    </p>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/sidepanel/components/MarkItem.vue
git commit -m "feat(sidepanel): show context hint when mark restore failed"
```

---

## Task 6: 设置项新增 `highlightHeight`

**Files:**
- Modify: `src/logic/settings.ts:3-16`

- [ ] **Step 1: 在 `defaultSettings` 中添加字段**

```typescript
export const defaultSettings = {
  defaultHighlightColor: '#FFFF00',
  highlightColors: [
    '#FFFF00',
    '#99FF99',
    '#FF9999',
    '#99CCFF',
    '#FFCC99'
  ],
  blacklist: [] as string[],
  shortcutSave: 'Alt+S',
  shortcutDelete: 'Alt+D',
  autoAssociation: true,
  highlightHeight: 5
}
```

- [ ] **Step 2: Commit**

```bash
git add src/logic/settings.ts
git commit -m "feat(settings): add highlightHeight default"
```

---

## Task 7: `highlightDefaultStyle` 支持高度参数

**Files:**
- Modify: `src/logic/config.ts:23-27`

- [ ] **Step 1: 修改函数签名与实现**

```typescript
export const highlightDefaultStyle = (
  color: string | Ref<string> = defaultSettings.defaultHighlightColor,
  height: number = defaultSettings.highlightHeight,
) =>
  `box-shadow: inset 0 -${height}px 0 0 ${color}; padding-bottom: ${height}px; cursor: pointer;`
```

- [ ] **Step 2: Commit**

```bash
git add src/logic/config.ts
git commit -m "feat(config): support highlightHeight in default style"
```

---

## Task 8: 所有高亮操作使用 `settings.value.highlightHeight`

**Files:**
- Modify: `src/contentScripts/index.ts:61-65`
- Modify: `src/contentScripts/ui.ts:189-215`, `269-299`, `341-343`
- Modify: `src/contentScripts/restorer.ts:90-93`, `169-172`, `288-296`

- [ ] **Step 1: `index.ts` 预览高亮**

```typescript
state.previewApplier = rangy.createClassApplier('webext-highlight-preview', {
  elementTagName: 'span',
  elementAttributes: { style: `${highlightDefaultStyle(settings.value.defaultHighlightColor, settings.value.highlightHeight)} ` },
  normalize: false
})
```

- [ ] **Step 2: `ui.ts` 创建高亮与颜色变更**

将 `highlightDefaultStyle(color)` 或 `highlightDefaultStyle(mark.color)` 全部替换为带 height 的版本：

```typescript
elementAttributes: { style: highlightDefaultStyle(mark.color, settings.value.highlightHeight) }
```

颜色变更处的 `el.style.boxShadow = ...` 也需要同步生成完整样式：

```typescript
el.style.boxShadow = `inset 0 -${settings.value.highlightHeight}px 0 0 ${color}`
el.style.paddingBottom = `${settings.value.highlightHeight}px`
```

- [ ] **Step 3: `restorer.ts` 恢复高亮与滚动动画**

```typescript
elementAttributes: { style: highlightDefaultStyle(mark.color, settings.value.highlightHeight) }
```

`scrollToMark` 中：

```typescript
el.style.boxShadow = `inset 0 -${settings.value.highlightHeight}px 0 0 ${settings.value.highlightColors[1]}`
// ...
el.style.boxShadow = `inset 0 -${settings.value.highlightHeight}px 0 0 ${mark.color}`
```

- [ ] **Step 4: Commit**

```bash
git add src/contentScripts/index.ts src/contentScripts/ui.ts src/contentScripts/restorer.ts
git commit -m "feat(highlight): apply highlightHeight across content scripts"
```

---

## Task 9: Options 页面新增高度设置 UI

**Files:**
- Modify: `src/options/Options.vue:154-162` (navItems)
- Modify: `src/options/Options.vue:361-385` 附近新增 section

- [ ] **Step 1: 新增导航项**

```typescript
const navItems = [
  { id: 'welcome', label: '欢迎使用' },
  { id: 'default-color', label: '默认高亮颜色' },
  { id: 'highlight-height', label: '高亮标记高度' },
  { id: 'color-palette', label: '高亮颜色配置' },
  { id: 'shortcuts', label: '快捷键设置' },
  { id: 'blacklist', label: '网站黑名单' },
  { id: 'error-logs', label: '错误日志' },
  { id: 'github-sync', label: 'GitHub 同步' },
]
```

- [ ] **Step 2: 新增设置区块**

在「默认高亮颜色」区块之后插入：

```vue
<!-- Highlight Height -->
<div id="highlight-height" class="setting-card scroll-mt-8">
  <h2 class="text-[18px] font-semibold mb-[12px]">
    高亮标记高度
  </h2>
  <p class="text-[14px] text-gray-500 mb-[16px]">
    控制高亮下划线的厚度与底部边距（1–20 像素）。数值越大，下划线越粗，文字下方的空白也越大。
  </p>
  <div class="flex items-center gap-[16px]">
    <input
      v-model.number="localSettings.highlightHeight"
      type="range"
      min="1"
      max="20"
      class="flex-1"
    >
    <span class="w-[48px] text-center font-mono text-[14px]">{{ localSettings.highlightHeight }}px</span>
  </div>
  <div class="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
    <span class="text-[14px]" :style="{ boxShadow: `inset 0 -${localSettings.highlightHeight}px 0 0 ${localSettings.defaultHighlightColor}`, paddingBottom: `${localSettings.highlightHeight}px` }">
      这是预览效果
    </span>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/options/Options.vue
git commit -m "feat(options): add highlight height setting UI"
```

---

## Task 10: 保存设置后广播刷新

**Files:**
- Modify: `src/options/Options.vue:83-99`

- [ ] **Step 1: 在 `saveSettings` 中广播 refresh-highlights**

在原有 `sendMessage('refresh-sidepanel-data', ...)` 之后增加：

```typescript
// 通知所有 content script 刷新高亮样式
const tabs = await browser.tabs.query({ status: 'complete' })
for (const tab of tabs) {
  if (tab.id && tab.url && tab.url.startsWith('http')) {
    sendMessage('refresh-highlights', {}, { context: 'content-script', tabId: tab.id }).catch(() => {})
  }
}
```

注意：需要在 `Options.vue` 顶部引入 `browser`：

```typescript
import browser from 'webextension-polyfill'
```

- [ ] **Step 2: Commit**

```bash
git add src/options/Options.vue
git commit -m "feat(options): broadcast refresh-highlights after settings save"
```

---

## Task 11: 更新测试

**Files:**
- Modify: `src/tests/search.spec.ts`
- Modify: `src/tests/restorer.spec.ts`
- Modify: `src/tests/ui.spec.ts`
- Modify/Create: `src/tests/config.spec.ts`

- [ ] **Step 1: 更新 `search.spec.ts`**

将依赖模糊共识的用例改为 `it.skip` 或删除：

```typescript
it.skip('should find unique candidate even if text has minor changes (fuzzy)', () => {
  // skipped: Level 3 consensus strategy is temporarily disabled
})
```

- [ ] **Step 2: 更新 `restorer.spec.ts`**

修改 mock 的 `settings` 增加 `highlightHeight`：

```typescript
settings: ref({
  defaultHighlightColor: '#FFFF00',
  highlightColors: ['#FFFF00', '#99FF99', '#FF9999', '#99CCFF', '#FFCC99'],
  blacklist: [],
  highlightHeight: 5,
})
```

新增测试（需要正确 mock `sendMessage`）：

```typescript
it('should mark restore as failed when path and search both fail', async () => {
  const { sendMessage } = await import('webext-bridge/content-script')
  vi.mocked(sendMessage).mockImplementation(async (message: string) => {
    if (message === 'get-marks-for-url') return [{ id: 'm1', text: 'missing', rangySerialized: 'bad', url: 'http://test' }]
    if (message === 'update-mark-details') return { success: true }
    return undefined
  })
  document.body.innerHTML = '<div>different content</div>'
  await restorer.restoreHighlights()
  const updateCalls = vi.mocked(sendMessage).mock.calls.filter(c => c[0] === 'update-mark-details')
  expect(updateCalls.length).toBeGreaterThan(0)
  expect((updateCalls[0][1] as any).restoreFailedAt).toBeDefined()
})
```

- [ ] **Step 3: 更新 `ui.spec.ts`**

mock 的 `settings` 同样增加 `highlightHeight: 5`。

- [ ] **Step 4: 新增 `config.spec.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { highlightDefaultStyle } from '../logic/config'

describe('highlightDefaultStyle', () => {
  it('should use default height of 5', () => {
    expect(highlightDefaultStyle('#FFFF00')).toBe('box-shadow: inset 0 -5px 0 0 #FFFF00; padding-bottom: 5px; cursor: pointer;')
  })

  it('should accept custom height and convert to positive padding', () => {
    expect(highlightDefaultStyle('#FF0000', 8)).toBe('box-shadow: inset 0 -8px 0 0 #FF0000; padding-bottom: 8px; cursor: pointer;')
  })
})
```

- [ ] **Step 5: Commit**

```bash
git add src/tests
git commit -m "test: update specs for skipped recovery and highlight height"
```

---

## Task 12: 最终验证

- [ ] **Step 1: 运行 lint**

```bash
pnpm lint
```

预期：无错误。

- [ ] **Step 2: 运行类型检查**

```bash
pnpm typecheck
```

预期：无错误。

- [ ] **Step 3: 运行测试**

```bash
pnpm test
```

预期：全部通过。

- [ ] **Step 4: Commit 任何自动修复**

```bash
git add -A
git commit -m "chore: lint and type fixes"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: 每个 spec 需求都有对应任务。
- [x] **Placeholder scan**: 无 TBD/TODO/"implement later"。
- [x] **Type consistency**: `restoreFailedAt`、`highlightHeight` 在所有任务中命名一致。

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-06-26-markflow-ux-improvements-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach would you like to use?
