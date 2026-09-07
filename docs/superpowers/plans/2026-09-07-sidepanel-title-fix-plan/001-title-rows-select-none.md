# Task 001: 三级标题行 select-none

## Context

侧边栏三级可点击行多击时浏览器原生选区会选中文字。Driver 已确认范围含标记正文(复制走 ⋯ 菜单「复制标记」)。

## Current Logic → Target Logic

| 文件 | 位置 | 改动 |
| :--- | :--- | :--- |
| `src/sidepanel/components/TagFolder.vue` | L176 summary class | 加 `select-none` |
| `src/sidepanel/components/PageSection.vue` | L118-121 网页头 header class | 加 `select-none` |
| `src/sidepanel/components/PageSection.vue` | L212-216 章节头 header class | 加 `select-none` |
| `src/sidepanel/components/MarkItem.vue` | L62 标记正文可点 div | 加 `select-none` |
| `src/sidepanel/components/MarkItem.vue` | L145-153 备注 p | 加 `select-none` |

## Verification

```bash
grep -n "select-none" src/sidepanel/components/TagFolder.vue src/sidepanel/components/PageSection.vue src/sidepanel/components/MarkItem.vue  # 5 处
npm run build  # exit 0
```
