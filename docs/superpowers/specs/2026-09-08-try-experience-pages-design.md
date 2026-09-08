# 体验页（免安装功能体验）设计

**日期**: 2026-09-08
**状态**: 已批准（2026-09-08 Driver 确认），同日范围修订
**生命周期**: 标准生命周期（Surgical 触发器 3/4——「修改已存在功能」不满足，本任务为全新模块）
**Driver 已决事项**: ①页面规模 4~5 页 ②空白起步 + 重置按钮 ③暂不做 EN 版

> **修订记录**: 2026-09-08 Driver 指令范围变更——①移除标签功能（侧栏改为页面文件夹层级管理，PageSection 折叠模式简版）；②页面 5 → 4（移除 E「个人总结」）；③新增快捷标记 Alt+S / 快捷删除 Alt+D（对齐 `settings.ts:13-14` + `Tooltip.vue:141-150`，event.code 判定，仅气泡打开时生效）；④新增核心功能说明弹窗（标记/跳转/快捷标记/快捷删除）；⑤侧栏文件夹以网页标题命名（对齐 `tagTree.ts:47` 取首个有 title 标记，创建时记录 `data-title`，对齐 `ui.ts:415`）。
>
> **修订 2**: 2026-09-08 Driver 快速调整——①EN 落地页同步加「Experience」入口（内容不翻译，交浏览器翻译）；②体验页章节切换从左上角页签移至右下角悬浮条（`fixed bottom-6 right-6 lg:right-[316px]`，避开右侧栏）；③落地页 hero 入口顺序与措辞统一为「体验 / 预览 / 下载」（EN: Experience / Preview / Download），章节标签同步重命名（演示→预览、安装→下载，锚点 id 不变）。
>
> **修订 3**: 2026-09-08 Driver 快速调整——章节切换条从右下角悬浮改为内嵌在文章结尾，与「摘自…」出处行同一行（`flex flex-wrap items-baseline`，出处居左、切换条 `ml-auto shrink-0` 居右；空间不足时切换条整体换行靠右，字母不被压缩），悬浮块删除。
>
> **修订 4**: 2026-09-08 Driver 快速调整——章节切换位置不变（文章结尾与出处同行），样式由描边药丸盒改为纯文本 `link-line` 页签（对齐落地页 hero `docs/index.html:114-118`：`flex gap` + 下划线链接 + hover 琥珀；当前页琥珀加粗，无盒子、无描边）。
>
> **修订 5**: 2026-09-08 Driver 决策——「体验 / 预览」对比度不足（都是"看"，缺动手/旁观对立），落地页文案双向拉开：zh hero 与章节标签「预览」改回「演示」（撤销修订 2 ③的该部分），EN 侧「Experience → Try it」（祈使动词补动作感）、「Preview → Demo」。锚点 id 不变，体验页内标签不动。
>
> **修订 6**: 2026-09-08 PR #84 CR 修复——①Blocking：`unwrap` 移除 `parent.normalize()`（锚点为 textContent 偏移，拆分/合并文本节点均不改变 textContent，normalize 本不影响锚点；防御性移除 + 新增同段落双标记删除回归测试守护）；②Nit：`.color-dot` 亮色边框透明度 0.15→0.25；③Nit：说明弹窗加 `role="dialog" aria-modal="true" aria-label` + 焦点管理（打开聚焦关闭按钮、关闭归还触发按钮）；④Nit 仅回复不改码：`shortcutSave` 存储即完整组合键（`Tooltip.vue:108-121` formatShortcut 按 `+` 拆分解析），kbd 展示与触发同源一致。

## Goal

在 docs 静态站新增 `docs/try/` 体验页组（5 页，A~E），用纯 JS **复刻**扩展核心交互（Alt 划词标记 → 侧栏归类 → 点击回跳），让访客**免安装**体验"标记 → 归类 → 回跳"功能闭环；落地页 hero 增加「体验」入口。体验页后期直接用于录屏宣传视频。

## 设计哲学（一句话）

布列松的方法：删减、精确、必要、拒绝表演（内容必须真实——取自 Driver 真实读书笔记，`docs/2025.12.19_摘录、总结、《电影的节奏是心跳》、布列松/`）。概念映射：**标记 = 碎片（形式），标签 = 关系（影像之间的关系赋予影片以生命），跳转 = 节奏**。

## 目标 / 非目标

**目标**

- 4 个内容页 + 共享 `try.css` + 共享 `try.js`，零构建、零新外部依赖（沿用 Tailwind CDN）
- 模拟引擎保真复刻：Alt+划词 → Tooltip（5 色点，Alt+S 默认色快捷标记）→ 5px 底部色条标记 → 右侧固定栏（页面文件夹层级：标题命名、折叠、组内物理排序）→ 点击回跳（本页琥珀脉冲 / 跨页 hash 锚点）；已有标记气泡（删除 / Alt+D 快捷删除）
- 核心功能说明弹窗（导航「说明」按钮，标记/跳转/快捷标记/快捷删除四行，Esc/遮罩/按钮关闭）
- `localStorage` 持久化（同源跨页共享），结构镜像 `marks-by-url-storage`；侧栏底部「重置体验」按钮
- 质感对齐宣传页：neutral 色板、hairline、零阴影、明暗双模（共享 `theme` localStorage 键）、`prefers-reduced-motion`
- 落地页 `docs/index.html` hero 链接行加「体验」，置于「安装」「演示」之前

**非目标（YAGNI）**

- ❌ EN 版体验页（笔记为中文；EN 落地页加入口，内容交浏览器翻译）
- ❌ 标签功能（修订后移除；侧栏改为页面文件夹层级）
- ❌ 预置示例标记（空白起步，录屏现场标记更有说服力）
- ❌ 模拟导出 Markdown / Gist 同步 / 搜索 / 章节大纲 / 备注 textarea（核心闭环之外）
- ❌ 修改扩展代码；不为 docs 引入构建管线或测试框架（验证以三层证据适配，见 §6）
- ❌ 移动端完整适配：窄屏/触屏显示提示条「体验需在桌面浏览器中进行」，侧栏隐藏
- ❌ 不动 `sitemap.xml`、SiYuan 导出目录（内容来源，仅引用其文本）

## 内容方案（真实笔记拆分，每页再做一次删减）

| 页 | 章节 | 保留的核心概念（可标记点） |
| :--- | :--- | :--- |
| A `index.html` | 让内在来指挥 | "影像的节奏无法改变内在的缓慢""只有人物内部心结的产生与和解才能给电影带来运动"（P27） |
| B `b.html` | 以手、物件和眼神为主题的电影（《快报》） | "无意识行为"（P79，四分之三行为是无意识的）、"**节奏源于精确**"（P80）、手/物件/眼神 |
| C `c.html` | 触及神秘（《面具与羽毛》） | "必要的影像"（P89）、"影像之间的关系赋予影片以生命"、"越是相似越不相同"（P95） |
| D `d.html` | 诗歌与真实是姐妹（《电影之友》） | "创造首先就是删减"、"诗意源自真实细节的组合"、无意识行为再现（P172） |

概念闭环：A「节奏/心结」→ B「节奏源于精确」；B「无意识行为」→ D（P172）。

## 技术方案

### 文件结构

```text
docs/try/
├── index.html    # A · 让内在来指挥
├── b.html … d.html
├── try.css       # hairline / 标记 span / Tooltip / 侧栏 / 弹窗样式，明暗双模
└── try.js        # 模拟引擎（vanilla JS，约 380 行）
```

每页骨架：顶部 mono 导航行（`← MarkFlow` + `A B C D` 页签 + 「说明」+ 明暗切换）→ 章节标签（如 `体验 / 笔记 A`）→ 正文（`max-w-2xl`，段落带 `data-para` 索引，`<body data-page data-title>`）→ 右侧固定侧栏（`fixed right-0`，宽 300px，hairline 左边框，仅 ≥lg 显示）→ 说明弹窗（遮罩 + hairline 卡片，零阴影）。

### 模拟引擎模块（try.js）

`store`（localStorage 读写，键 `markflow-try-marks`，结构 `Record<pageId, Mark[]>`）→ `anchor`（段落索引 + 文本偏移定位/校验）→ `render`（TreeWalker 跨文本节点包裹 `<span data-mid>`）→ `tooltip`（选区上方定位，5 色点 + 快捷键提示，150ms 弹入）→ `sidebar`（页面文件夹层级渲染）→ `jump`（滚动 + 琥珀脉冲 + hash 处理）→ `modal`（说明弹窗）→ `hint`（首访引导条）。

### 保真对齐表（SSOT）

| 行为 | 对齐扩展实现 |
| :--- | :--- |
| Alt+划词判定 | `src/contentScripts/index.ts:191`（`altKey && !isCollapsed`） |
| 标记样式 | `src/logic/config.ts:25`：`box-shadow: inset 0 -5px 0 0 <色>; padding-bottom: 5px; cursor: pointer` |
| 色板 | `src/logic/settings.ts:3-16`：`#FFFF00/#99FF99/#FF9999/#99CCFF/#FFCC99` |
| 标记创建 | 点击色点即创建（与落地页文案「按住 Alt 选中文字，选择颜色」一致）；**Alt+S 默认色（黄）快捷标记**，仅气泡打开时生效（对齐 `Tooltip.vue:141-150`） |
| 已有标记 | 点击弹小 Tooltip：「删除」+ Alt+D 提示；**Alt+D 快捷删除** |
| 侧栏层级 | 页面文件夹（标题命名，对齐 `tagTree.ts:47` 取首个有 title 标记；创建时记录 `data-title`，对齐 `ui.ts:415`）→ 标记条目；文件夹可折叠（PageSection 模式简版，chevron ▸/▾）；组内按物理位置（paraIdx,start）排序；当前页文件夹琥珀色 |
| 回跳脉冲 | `src/contentScripts/restorer.ts:379-399`：`scrollIntoView({block:'center'})` + 色条 0.5s 过渡 `#fbbf24`，停留 1000ms 还原 |
| 跨页跳转 | 镜像 `useMarkActions.ts:42-46` + `index.ts:76-92`：`<page>.html#mark-<id>`，目标页加载后滚动+脉冲并清 hash |
| 数据结构 | 镜像 `src/logic/storage.ts` Mark 字段子集：`id/title/text/color/createdAt` + 锚点 `{paraIdx,start,end}` |

### 安全（合规 BLOCKING）

- 无任何用户文本输入（标签功能已移除）；动态 DOM 一律 `textContent` 赋值
- 无密钥/token 硬编码；不新增外部依赖（Tailwind CDN 与落地页一致，已是既有风险面）

### 落地页改动

`docs/index.html` hero 链接行（`:114-117`）：`体验（./try/） / 预览（#demo） / 下载（#install）`；章节标签同步重命名（`01 / 演示`→`01 / 预览`、`03 / 安装`→`03 / 下载`，锚点 id 不变）。`docs/lang/en/index.html` 同步：`Experience（../../try/） / Preview / Download` + `01 / PREVIEW`、`03 / DOWNLOAD`。

## 风险与缓解

| 风险 | 缓解 |
| :--- | :--- |
| 跨文本节点选区包裹 | TreeWalker 收集选区内文本节点，逐段 splitText 包裹（标准解法） |
| 重叠标记 | 选区与已有 `[data-mid]` 相交 → 不创建，选区旁显示一行提示「暂不支持重叠标记」 |
| 锚点恢复失败 | 内容为静态：按 `{paraIdx,start,end}` 定位后校验 `substring === text`，失败则该条标记侧栏置灰 |
| 暗色可读性 | 底部色条形态天然兼容双模；Tooltip/侧栏用实底 + hairline |
| 录屏重录 | 侧栏底部「重置体验」清空 `markflow-try-marks` 并刷新 |
| 窄屏/触屏 | `<lg` 显示提示条，侧栏 `hidden`；核心交互依赖 Alt 键，不妥协移动端 |

## 验证（三层证据适配）

- **Layer 1**：lefthook（conventional-commit、audit_check 对应 `.project/ops_changelog.md` 追加、check-docs-structure）；CI：`audit_check` + `spec_plan_sync` 强制通过
- **Layer 2**（Generator 自检，Playwright 自动化）：标记创建（色点 + Alt+S 快捷）/删除（气泡 + Alt+D 快捷 + 侧栏 ×）、本页回跳脉冲、跨页 hash 回跳、刷新后恢复、组内物理排序、文件夹折叠、说明弹窗开闭、重置、暗色切换、reduced-motion、窄屏提示、重叠拒绝、`node --check try.js`
- **Layer 3**（运行时走查）：本地 `python3 -m http.server` 起 docs/，Chrome 已走查（截图存档）；Firefox 待 Driver 人工或授权安装 Playwright Firefox 二进制。录屏动线：A 标「心结」→ B 标「节奏源于精确」→ D 标「删减、剔除」→ 侧栏跨页逐一点击回跳，琥珀脉冲可见
- **TDD 适配说明**：docs 零构建、无测试管线，为 `try.js` 引入测试框架违反 YAGNI（参考 `test-driven-development.md`：UI 组件 ⭐⭐⭐、一次性演示场景从简）——以 Layer 2 检查清单 + Layer 3 运行时走查替代单元测试。**待 Driver 裁决**

## Boundaries

- **范围**：`docs/try/{index,b,c,d}.html`、`docs/try/try.css`、`docs/try/try.js`、`docs/index.html`、`docs/lang/en/index.html`，共 8 个文件（E 页随修订删除）
- **不动**：扩展全部代码、`sitemap.xml`、SiYuan 导出目录、落地页其余部分
- **回滚**：`git checkout HEAD -- docs/index.html` + 删除 `docs/try/`（纯新增，无数据迁移）
