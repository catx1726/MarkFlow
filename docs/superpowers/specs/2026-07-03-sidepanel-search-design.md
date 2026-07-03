---
spec_id: SPEC-2026-07-03-001
title: 侧边栏搜索功能
date: 2026-07-03
status: draft
---

# 侧边栏搜索功能

## 1. 背景与目标

随着用户高亮、网页和标签数量增加，侧边栏（Sidepanel）会出现严重的"滚动地狱"。项目已通过 tag → page → group → mark 的分层结构、标签分类等手段缓解，但仍缺少直接定位内容的入口。

本规格要求为侧边栏增加**搜索功能**，并调整新建标签的交互，使搜索框常驻、创建标签折叠，从而进一步减少滚动、提升查找效率。

## 2. 需求范围

### 2.1 搜索入口

- 在 `SidepanelHeader.vue` 顶部放置常驻搜索框。
- 搜索框右侧放置新建标签按钮（"+"），点击后展开为单行输入框。
- 搜索框聚焦并按 `Enter` 时，不触发新建标签逻辑。

### 2.2 搜索上下文

- 搜索命中后，保留**命中的 mark 所在的完整 page**，以及该 page 所属的 tag。
- 未命中的 page 和 tag 不在结果树中显示。
- 命中 mark 在视觉上可高亮，但不过度改变现有 UI。

### 2.3 新建标签折叠

- 用 `isCreatingTag` 状态控制展开/收起。
- 展开后自动聚焦输入框；按 `Enter` 或点击"创建"确认。
- 按 `Esc` 或失焦时，若输入为空则收起，有内容则保留输入避免误关。
- 创建成功后清空输入并自动收起。

### 2.4 空状态

- 搜索无结果时，在 tree 区域显示提示文案和"清除搜索"按钮。

## 3. 交互设计

### 3.1 顶部区域

```
┌─────────────────────────────────────┐
│ 🔍 [搜索内容...]            [+]     │  ← 默认状态
├─────────────────────────────────────┤
│ 🔍 [搜索内容...]            [✓]     │  ← 点击 + 后
│       [新建标签名称...]             │
└─────────────────────────────────────┘
```

- 搜索框：左侧搜索图标、右侧清除按钮（有内容时显示）。
- "+" 按钮：点击展开新建标签输入框；再次点击或创建完成后收起。

### 3.2 搜索结果树

- 命中规则：关键词与 `mark.text`、`mark.html`、`mark.note`、`pageTitle`、`group.title`、`tagName` 大小写不敏感匹配。
- 多关键词用空格分隔，默认 AND 关系。
- 只要一个 page 内存在命中 mark，该 page 下所有 mark、group 均保留展示。
- 未命中的 tag/page 直接隐藏。

## 4. 数据流

1. `SidepanelHeader.vue` 中搜索框绑定 `searchQuery`，通过事件 `update:searchQuery` 同步给 `Sidepanel.vue`。
2. `Sidepanel.vue` 中使用 `computed` 计算 `filteredTree`：
   - 空查询返回完整 `structuredMarks`。
   - 非空查询遍历 `TagTree`，按命中规则过滤，保留命中 page 的完整结构。
3. `filteredTree` 传给 `TagFolder.vue` 渲染，保持现有组件接口不变。

## 5. 关键实现细节

### 5.1 搜索防抖

- 输入防抖 150ms，使用 `@vueuse/core` 的 `useDebounceFn` 或项目已有的 `setTimeout` 模式。
- 过滤计算本身使用 `computed`，避免重复遍历。

### 5.2 命中判定

```typescript
function isMarkMatch(mark: Mark, term: string): boolean {
  const fields = [
    mark.text,
    mark.html,
    mark.note,
    mark.title,
    mark.url,
  ].filter(Boolean).map(f => f!.toLowerCase())
  return fields.some(f => f.includes(term))
}
```

- `pageTitle` 和 `tagName` 在 page/tag 层级单独判定。
- 只要 mark 命中、pageTitle 命中或 tagName 命中，即保留该 page。

### 5.3 新建标签状态

- 状态建议放在 `useTagActions.ts` 中，作为 `isCreatingTag` 和 `newTagName`。
- `SidepanelHeader.vue` 通过 composable 共享状态，保持单文件职责清晰。

### 5.4 无障碍与键盘

- 搜索框使用 `<input type="search">`，支持浏览器默认清除。
- 新建标签输入框展开后自动 `focus()`，并通过 `ref` 管理。

## 6. 测试策略

1. **单元测试**：在 `src/sidepanel/composables/__tests__/useSidepanelData.spec.ts` 中新增过滤函数测试，覆盖：
   - 空查询返回完整树。
   - 单关键词命中 mark、pageTitle、tagName。
   - 多关键词 AND 逻辑。
   - 命中 page 保留同页其他 mark。
2. **组件测试**：验证 `SidepanelHeader.vue` 中搜索输入、清除按钮、新建标签展开/收起行为。
3. **回归测试**：运行现有 sidepanel 相关测试，确保无新增失败。

## 7. 验收标准

- [ ] 侧边栏顶部出现常驻搜索框，输入后 150ms 内触发过滤。
- [ ] 搜索结果保留命中 mark 所在完整 page 及其 tag。
- [ ] 搜索无结果时显示空状态提示和"清除搜索"按钮。
- [ ] 新建标签通过 "+" 按钮展开/收起，创建成功后自动收起。
- [ ] 现有 sidepanel 测试不新增失败。

## 8. 不在范围内

- 全局快捷键搜索。
- 搜索结果排序/权重算法。
- 搜索历史或建议。
- 对 mark 内容的全文索引或模糊搜索（仍使用简单字符串包含匹配）。

## 9. 相关文件

- `src/sidepanel/Sidepanel.vue`
- `src/sidepanel/components/SidepanelHeader.vue`
- `src/sidepanel/components/TagFolder.vue`
- `src/sidepanel/composables/useSidepanelData.ts`
- `src/sidepanel/composables/useTagActions.ts`
- `src/logic/tagTree.ts`
