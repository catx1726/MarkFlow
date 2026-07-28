# Spec: 标签记忆（Tag Memory）— 新建标记默认预选上次标签

**日期**: 2026-07-28
**状态**: Draft（待 Driver 审查）
**来源需求**: `docs/NIT_ROADMAP.md` §3 "记忆上次使用的标签，下次标记默认预选"
**生命周期**: 标准生命周期（涉及数据模型变更：`settings` 新增持久化字段）

---

## 1. 背景与问题

当前在网页上新建标记时（`contentScripts/index.ts` 的 `processSelection` → `ui.show(...)`），传给 Tooltip 的 `initialTags` 恒为 `[]`。因此每次新建标记，标签选择都从空开始。

用户在批量整理一篇长文到同一课题时（例如连续标记 20 处都归到"前端优化"标签），每次都要重新点选同一标签，认知负担高且打断阅读流。

## 2. 目标 / 非目标

**目标**
- 新建标记时，Tooltip 自动预选"上一次新建标记时选择的标签集合"
- 标签被删除后，预选不会出现悬空（ghost）选中
- 编辑已有标记的行为完全不变

**非目标（YAGNI）**
- 不在设置中心提供独立的"清除记忆"按钮——用户可通过"新建一个不选标签的标记再保存"来清空
- 不参与 Gist 多端同步——`lastUsedTags` 是本地偏好（与 `defaultHighlightColor` 同级）
- 不记忆"每页/每域"不同的标签集合——全局单一记忆

## 3. 行为规则

| 场景 | 行为 |
|---|---|
| 新建标记，打开 Tooltip | 预选 `settings.lastUsedTags`，过滤掉 `tagsMetadata` 中已不存在的 id |
| 编辑已有标记，打开 Tooltip | 预选该 mark 原有 `tags`（**不受 lastUsedTags 影响**，沿用 `showTooltipForExistingMark` 现有路径） |
| 新建标记保存时 | `settings.lastUsedTags = 本次 selectedTags`（**含空集合**——空也记空，下次默认不预选） |
| 编辑已有标记保存时 | **不更新** `lastUsedTags`（避免编辑旧无标签标记意外清空记忆） |
| 跨设备同步 | 不同步（本地存储） |

**"空也记空"语义说明**：`lastUsedTags` 严格等于"上一次**新建**标记时选中的标签"。用户主动保存一个不选标签的新标记 = 显式清空记忆。

## 4. 数据模型变更

`src/logic/settings.ts` 的 `defaultSettings` 新增一个字段：

```ts
export const defaultSettings = {
  // ...existing fields...
  lastUsedTags: [] as string[],   // 上次新建标记时选中的标签 id 集合（本地偏好，不同步）
}
```

通过现有 `useWebExtensionStorage('webext-settings', defaultSettings)` 自动持久化。
**向后兼容**：旧用户 storage 中无此字段，`useWebExtensionStorage` 的 `mergeDefaults` 机制会补默认值 `[]`（`tagsMetadata` 已用此机制，行为可证）。

## 5. 实现改动点

| # | 位置 | 当前 | 目标 |
|---|---|---|---|
| 1 | `src/logic/settings.ts` | — | 新增 `lastUsedTags: [] as string[]` |
| 2 | `src/contentScripts/index.ts:238`（新建标记 `ui.show` 调用） | 第 7 参（tags）传 `[]` | 改为传 `settings.value.lastUsedTags`（**原始未过滤**） |
| 3 | `src/contentScripts/ui.ts:402` 附近（`add-mark` 前，仅新建分支） | — | 新建保存时 `settings.value.lastUsedTags = [...tags]`。**不要**加在 `update-mark-details` 分支（ui.ts:276-282） |
| 4 | `src/contentScripts/views/Tooltip.vue` 的 `show()` | `selectedTags.value = [...initialTags]`（行 199） | 在 `allTags` 就绪后过滤悬空 id：`selectedTags.value = filterExistingTags(initialTags, allTags.value)` |
| 5 | 过滤纯函数 | — | 提取 `filterExistingTags(ids: string[], allTags: Tag[]): string[]`（返回只含 allTags 中现存 id 的数组），放 `logic/tagTree.ts` 或新建 `logic/tags.ts`，便于单测 |

**过滤位置说明**：`allTags`（权威标签列表）在 Tooltip 内部经 `sendMessage('get-all-tags')` 异步获取，index.ts 拿不到。故过滤必须在 Tooltip.show() 内、allTags 就绪后做，而非在 index.ts。这也意味着编辑已有标记路径同样受益于过滤（mark.tags 里若有历史悬空 id 也会被清掉，副作用正面）。

**编辑分支不变**：`ui.ts:276-282` 的 `update-mark-details` 路径保持原样，不触碰 `lastUsedTags`。

## 6. 边界情况

- **标签被删除**：预选过滤按 `tagsMetadata` 现存 id 校验；即便过滤遗漏，Tooltip 只渲染 `allTags` 里的标签，悬空 id 不会显示为选中（双重安全）
- **首次使用 / 记忆为空**：`lastUsedTags = []`，行为同现状
- **用户清空记忆**：新建一个标记、不选任何标签、保存 → `lastUsedTags = []`
- **编辑旧标记后新建**：编辑不影响记忆，新建仍用上次新建时的标签

## 7. 测试策略

- **纯函数单测（TDD）**：`filterExistingTags` 过滤悬空 id（核心可测逻辑）
- **集成验证（手动）**：
  1. 新建标记选 [A,B] 保存 → 再新建标记 → Tooltip 应预选 A,B
  2. 新建标记不选标签保存 → 再新建标记 → Tooltip 应无预选
  3. 编辑一个有标签 C 的旧标记 → Tooltip 预选 C（非 lastUsedTags）
  4. 删除标签 A → 再新建标记 → A 不预选

## 8. 风险与回滚

- **风险**：极低。新增字段向后兼容；预选是纯增量行为，不破坏现有保存流程
- **回滚**：移除 `lastUsedTags` 字段 + 还原 3 处改动点即可，无数据迁移

## 9. 不在此 Spec 范围

- "清除记忆"设置入口（YAGNI，靠空选保存实现）
- 多套记忆（按域名/课题切换）
- 记忆参与同步
