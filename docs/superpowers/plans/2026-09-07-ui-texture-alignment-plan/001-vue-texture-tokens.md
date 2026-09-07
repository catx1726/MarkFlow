# Task 001: Vue 组件质感 token 替换(7 文件)

## Context

宣传页已重构为布列松极简风（neutral 色板 / 零阴影 / 圆角收敛），扩展 Popup/Sidepanel 仍为 gray + shadow + rounded-lg 的卡片式风格。本 task 做机械 token 替换，不动任何结构与逻辑。

## Current Logic → Target Logic

| 文件 | 改动 |
| :--- | :--- |
| `src/popup/Popup.vue` | L95、L116 `gray-`→`neutral-`;L116 删 `shadow-sm`(L127 orange 警告条不动) |
| `src/sidepanel/Sidepanel.vue` | 17 处 `gray-`→`neutral-`;L325/L372 模态删 `shadow-xl` 且 `rounded-lg`→`rounded-md`;L229 空态卡片 `rounded-lg`→`rounded-md` |
| `src/sidepanel/components/SidepanelHeader.vue` | 12 处 `gray-`→`neutral-`;L106 删 `shadow-sm`;L38/L95 容器 `rounded-lg`→`rounded-md` |
| `src/sidepanel/components/PageSection.vue` | 22 处 `gray-`→`neutral-`;L156/L236 菜单删 `shadow-lg`;L112 卡片 `rounded-lg`→`rounded-md` |
| `src/sidepanel/components/TagFolder.vue` | 10 处 `gray-`→`neutral-`;L214 菜单删 `shadow-lg`;L177 文件夹行 `rounded-lg`→`rounded-md` |
| `src/sidepanel/components/MarkItem.vue` | 12 处 `gray-`→`neutral-`;L176 菜单删 `shadow-lg` |
| `src/sidepanel/components/StorageManager.vue` | 8 处 `gray-`→`neutral-`;L40 删 `shadow-lg` |

排除:`FoldPanel.vue`(0 匹配)。内容脚本注入 UI(Tooltip/DisambiguationModal)不在本 task 范围(Driver 已确认保留)。

## Verification

```bash
grep -rn "gray-" src/popup src/sidepanel   # 期望零残留
grep -rn "shadow-" src/popup src/sidepanel # 期望零残留
grep -rn "rounded-lg" src/popup src/sidepanel # 期望零残留
```
