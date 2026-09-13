# 商店 Listing 文案（AMO / CWS 通用）

> **红线**：遵守全站降调惯例（#85 起确立）——禁「智能/精准/瞬间/100%」类词；「数据仅存本地」「无需注册」为已核实表述。
> **使用**：AMO 现在更新（Driver 手动粘贴）；CWS 上架时直接取用同构文案。
> 2026-09-13 创建，来源：AMO 现行 listing 抓取核对 + repo description + 落地页 SEO 同构。

## AMO（addons.mozilla.org/developers/ → MarkFlow → Edit Listing）

### 标题（名称）

| locale | 文案 |
| :--- | :--- |
| zh-CN | `MarkFlow: 网页高亮与笔记，回跳原文` |
| en-US | `MarkFlow: Web Highlighter & Notes` |

> 取代 roadmap §7 旧提议「MarkFlow: 网页高亮 + ~~精准~~回跳」（该提议写于降调红线确立之前，作废）。

### 简介（Summary，搜索结果展示）

| locale | 文案 |
| :--- | :--- |
| zh-CN | 网页高亮与笔记工具。按住 Alt 划词标记，点击侧边栏笔记即可跳回原文位置。数据仅存本地，无需注册，可选 GitHub Gist 多端同步。 |
| en-US | Web highlighter with jump-back to the source. Hold Alt to highlight, click a note to jump back. Local-first, no signup, optional Gist sync. |

### 描述（Description）

**zh-CN**：

```
按住 Alt 划词标记，点击侧边栏笔记，即可跳回原文位置。

📍 回跳原文
标记保存在侧边栏，按章节自动归类；点击任意一条笔记，直接跳回网页上的原文位置。

🏷 结构化整理
标记自动按章节归入大纲，可打标签跨网页归类整理，支持备注与 Markdown 导出。

🛠 自适应恢复
页面结构漂移或容器复用时，系统会尝试自动修复标记位置；内容发生实质性增删或布局重构时，在侧边栏保留上下文供你确认。

🔄 多端同步（可选）
通过 GitHub Gist 在多台设备间同步标记；不开启同步时，数据仅存本地，无需注册。

快捷键：Alt+划词打开高亮工具栏，Alt+S 保存，Alt+D 删除（可在设置中自定义）。
```

**en-US**：

```
Hold Alt to highlight text, then click a note in the side panel to jump back to the exact spot.

📍 Jump back to the source
Marks are saved in the side panel and grouped by section. Click any note to jump back to its position on the page.

🏷 Structured organization
Marks are organized into a section outline automatically. Tag them across pages, add notes, and export to Markdown.

🛠 Adaptive restoration
If the page layout drifts or containers are reused, MarkFlow tries to re-attach marks automatically. When content changes substantially, the context is kept in the side panel for confirmation.

🔄 Multi-device sync (optional)
Sync marks across devices via GitHub Gist. Without sync, everything stays local — no signup needed.

Shortcuts: Alt+drag to open the highlight toolbar, Alt+S to save, Alt+D to delete (customizable in settings).
```

## CWS（Chrome Web Store，上架时取用）

| 字段 | 文案 |
| :--- | :--- |
| Name (en) | `MarkFlow: Web Highlighter & Notes` |
| Name (zh) | `MarkFlow: 网页高亮与笔记` |
| Summary (en) | Web highlighter with jump-back to the source. Local-first, no signup, optional Gist sync. |
| Summary (zh) | 网页高亮与笔记工具，点击笔记回跳原文位置。数据仅存本地，无需注册。 |
| Description | 取上方 AMO 对应语言完整描述 |

## Driver 手动步骤（AMO 更新）

1. 登录 `https://addons.mozilla.org/developers/` → Manage my submissions → MarkFlow → **Edit Listing**
2. 名称/简介/描述按 locale 粘贴上表文案（AMO 支持 zh-CN / en-US 分语言填写）
3. 提交——仅元数据变更，审核通常较快（小时~1 天）
4. 完成后在 roadmap §7 该行转正
