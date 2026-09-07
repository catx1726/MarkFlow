# Task 002: main.css 滚动条 token 中性化 + unocss 死 token 清理

## Context

`src/styles/main.css` 的滚动条/代码块 CSS 变量使用 gray/slate 系硬编码色值;`unocss.config.ts` 的 `theme.colors`(brand.blue / brand.red / border-color)全仓零引用(已 grep 确认)。

## Current Logic → Target Logic

### `src/styles/main.css`(L11-37 变量块 + L52-54 .btn-secondary)

| 变量 | 当前(gray/slate) | 目标(neutral) |
| :--- | :--- | :--- |
| `--scrollbar-thumb` | `rgba(156,163,175,0.5)` (gray-400) | `rgba(163,163,163,0.5)` (neutral-400) |
| `--scrollbar-thumb-hover` | `rgba(107,114,128,0.7)` (gray-500) | `rgba(115,115,115,0.7)` (neutral-500) |
| `--scrollbar-page-bg` | `#f3f4f6` (gray-100) | `#f5f5f5` (neutral-100) |
| `--code-inline-bg` / `--code-block-bg` | `#f3f4f6` | `#f5f5f5` |
| `--code-inline-text` | `#111827` (gray-900) | `#171717` (neutral-900) |
| `--component-scrollbar-thumb` | `#cbd5e1` (slate-300) | `#d4d4d4` (neutral-300) |
| `--component-scrollbar-thumb-hover` | `#94a3b8` (slate-400) | `#a3a3a3` (neutral-400) |
| `.dark --scrollbar-thumb` | `rgba(75,85,99,0.5)` (gray-600) | `rgba(82,82,82,0.5)` (neutral-600) |
| `.dark --scrollbar-thumb-hover` | `rgba(55,65,81,0.7)` (gray-700) | `rgba(64,64,64,0.7)` (neutral-700) |
| `.dark --scrollbar-page-bg` | `#111827` (gray-900) | `#171717` (neutral-900) |
| `.dark --code-inline-bg` | `#374151` (gray-700) | `#404040` (neutral-700) |
| `.dark --code-inline-text` | `#f9fafb` (gray-50) | `#fafafa` (neutral-50) |
| `.dark --code-block-bg` | `#1f2937` (gray-800) | `#262626` (neutral-800) |
| `.dark --component-scrollbar-thumb` | `#475569` (slate-600) | `#525252` (neutral-600) |
| `.dark --component-scrollbar-thumb-hover` | `#64748b` (slate-500) | `#737373` (neutral-500) |
| `.btn-secondary` | `bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600` | 同构 `neutral-` 替换 |

### `unocss.config.ts`

删除 L32-42 整个 `theme.colors` 块(brand.blue / brand.red / border-color 死 token),其余配置不动。

## Verification

```bash
npm run build  # exit 0
grep -n "gray-\|slate\|#f3f4f6\|#111827\|#374151\|#1f2937\|#cbd5e1\|#94a3b8\|#475569\|#64748b" src/styles/main.css  # 期望零残留
grep -n "brand\|border-color" unocss.config.ts  # 期望零残留
```
