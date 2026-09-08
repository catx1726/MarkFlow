# Task 001: 共享骨架 + try.css + 页面 A（docs/try/index.html）

## Context

体验页组从零开始。本 task 建立全部共享结构与样式，并产出第一个内容页 A，作为 B~E 的复制模板。设计 SSOT：`docs/index.html`（hairline / neutral / 零阴影 / 明暗双模 class 策略 / font-mono 标签）。

## Target Logic

### `docs/try/try.css`（新建）

| 选择器 | 规格 |
| :--- | :--- |
| `.hairline` | 复制 `docs/index.html:51-56`（黑 15% / 白 20%） |
| `.link-line` | 复制 `docs/index.html:57-67`（含 hover 琥珀） |
| `.mark` | 由 JS 内联 `box-shadow` 设色（对齐 `config.ts:25`）；CSS 只给 `cursor:pointer; transition: box-shadow .5s ease-in-out`（脉冲过渡对齐 `restorer.ts`） |
| `#tooltip` | 实底（`bg-white dark:bg-neutral-900`）+ hairline 边框 + `rounded-md`，**无阴影**；150ms 弹入（`@keyframes` + `prefers-reduced-motion` 兜底） |
| `#sidebar` | `fixed right-0 top-0 h-full w-[300px]`，hairline 左边框，`overflow-y-auto`；`<lg` 断点 `display:none` |
| 提示条 `#hint` | 顶部 mono xs 小字条，可关闭（状态存 `localStorage['markflow-try-hint-dismissed']`） |

Tailwind 用 CDN（与落地页一致），`darkMode:'class'` + 同版主题初始化脚本（共享 `localStorage.theme`）。

### `docs/try/index.html`（页面 A，新建）

结构契约（B~E 逐字复用，仅换内容与页签高亮）：

```text
<nav>    ← MarkFlow（../） ｜ 页签 A B C D E（当前页加粗/琥珀）｜ 明暗切换
<header> mono 标签「体验 / 笔记 A」+ 章节标题「让内在来指挥」
<main>   max-w-2xl；每段 <p data-para="0..n">（锚点依赖，禁止省略）
<aside>  #sidebar：标题「体验笔记」+ 分组容器 + 底部「重置体验」
<script> try.css / try.js 引用；主题初始化；try.js defer
```

内容：按 `_index.md` 内容选段契约 A 行取材（3~4 段），正文末尾附 mono 小字出处「摘自读书笔记《电影的节奏是心跳》」。

## Verification

```bash
python3 -m http.server 8000 --directory docs
# 浏览器打开 http://localhost:8000/try/：
# 1. 版心/字体质感与落地页一致；明暗切换正常且刷新后保持
# 2. 侧栏固定在右侧，<lg 宽度下隐藏且顶部出现提示条
# 3. 每段均有 data-para 属性（DevTools 抽查）
```
