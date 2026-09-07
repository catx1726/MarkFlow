# 侧边栏标题交互与网页标题显示修复设计

## Goal

修复侧边栏两个痛点：①三级标题行（标签/网页/章节/标记）多击时文本被误选中；②网页层级标题在标记缺 `title` 字段时降级显示 hostname 而非页面标题。

## Approach

1. **禁选**：给三级可点击行加 `select-none`——`TagFolder.vue` 的 summary、`PageSection.vue` 的网页头与章节头、`MarkItem.vue` 的正文与备注（含标记正文，Driver 已确认；复制仍可走 ⋯ 菜单「复制标记」）。
2. **展示层修复**:`tagTree.ts:47` 由 `marks[0]?.title` 改为 `marks.find(m => m.title)?.title`，跳过存储序首个无 title 的标记。
3. **旧数据回填**:`restorer.ts` 在 `get-marks-for-url` 返回后，对本页缺 `title` 的未删除标记，用现有 `update-mark-details` 消息补写当前 `document.title`（每 URL 每会话仅尝试一次，fire-and-forget)；旧数据随页面重访自愈。

## References

- 降级点：`src/logic/tagTree.ts:47`（`new URL(url).hostname` 兜底）
- 标题采集点：`src/contentScripts/ui.ts:415`（`title: document.title`，新建时已记录）
- 回填写入复用：`src/background/main.ts:221` `update-mark-details`(Object.assign 保字段）
- 历史成因：`47f4135` Revert 窗口期 / `title?: string` 可选字段 → 存量数据可能缺 title

## Boundaries

- **范围**:`src/logic/tagTree.ts`、`src/contentScripts/restorer.ts`、`src/sidepanel/components/TagFolder.vue`、`PageSection.vue`、`MarkItem.vue`，共 5 个文件。
- **标记正文禁选的代价**：侧边栏内不能直接划选标记文字；复制入口保留在 ⋯ 菜单（Driver 已确认接受）。
- **不动** hostname 兜底本身：整页标记均无 title 且页面未重访时，仍显示 hostname（回填需一次页面访问触发）。
- **回填幂等**：仅当 `!mark.title && !mark.deletedAt` 时写回；不覆盖已有标题；`document.title` 为空时跳过。
- **验证**:`npm run lint`（改动文件）/ `npm test` / `npm run build`;tagTree 新增「取首个有 title 标记」用例。
