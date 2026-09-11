# 落地页技术 SEO 设计

- **日期**: 2026-09-11
- **来源**: `docs/NIT_ROADMAP.md` §7「落地页技术 SEO」（品牌讨论 2026-09-10，P0）；handoff `coach-tip-closeout-2026-09-11.md` §3
- **状态**: 已批准（Driver 2026-09-11）
- **执行顺序**: 在 `feat/local-backup` 合并后进行（分支从合并后的 main 切出）；docs/ 纯静态，与扩展代码零冲突

## 1. 问题与目标

落地页 `flow.soulboy.site`（GitHub Pages）存在四项技术 SEO 缺口：

| 缺口 | 现状 |
| :--- | :--- |
| title 品类词 | zh 标题为「一款支持回跳原文的网页文本标记工具」，缺品类词「网页高亮」；EN 已有 "Web Highlighter" 但缺 "Notes"（与 repo description 品类词不同构） |
| 结构化数据 | 无 JSON-LD，搜索引擎无法富摘要识别产品类型 |
| sitemap 覆盖 | 仅 1 条 URL（zh 首页），缺 EN 落地页与 4 个 try 体验页 |
| hreflang | zh/en 双语页无互链声明，搜索引擎可能视作重复内容 |

**成功标准**：
1. zh/en title 含品类词且同构（对齐 repo description 的「网页高亮与笔记 / Web Highlighter & Notes」），遵守降调红线（无「智能/精准/瞬间/100%」）
2. 两页各含 `SoftwareApplication` JSON-LD，结构完整可被富摘要解析
3. `sitemap.xml` 覆盖全部 7 个 URL，两个落地页条目带 `xhtml:link` hreflang alternates
4. zh/en 互相 `link rel="alternate"`（zh-CN / en / x-default）+ 各自 canonical
5. 站内 URL 形态与 sitemap 完全一致（`/try/` 目录式、`/try/b.html` 文件式，与既有站内链接相同，避免 301）

## 2. 决策记录

| 决策点 | 结论 | 备选与理由 |
| :--- | :--- | :--- |
| 实现方式 | 手写静态 meta（head 内嵌 + 手工 sitemap） | 备选「npm script 扫描 docs/ 生成 sitemap」被否：仅 7 个 URL，过度工程（YAGNI） |
| x-default 指向 | zh 根页 `/` | 备选 `→ /lang/en/` 被否：主受众与默认语言是中文 |
| try 页处理 | 进 sitemap（独立 title/正文，长尾入口）；**不加** hreflang（单语言）、**不加** canonical（无重复版本，非双语对照页）、**不加** JSON-LD（非产品页，避免信号稀释） | 备选「全 noindex」被否：体验页有真实内容，是长尾关键词入口 |
| title 措辞 | 与 repo description 品类词同构（2026-09-11 已核实的降调版） | 遵守全站降调红线；「网页高亮与笔记」/「Web Highlighter & Notes」双卡位 |
| sitemap URL 形态 | 与站内链接一致（`/try/`、`/try/b.html`） | 规范形式混用会引入 301/重复收录，一致性优先 |

## 3. 改动明细

### 3.1 title（两页，同步 og:title / twitter:title）

| 页 | 现 | 新 |
| :--- | :--- | :--- |
| zh `docs/index.html` | MarkFlow - 一款支持回跳原文的网页文本标记工具 | `MarkFlow – 网页高亮与笔记，划词标记并回跳原文` |
| en `docs/lang/en/index.html` | MarkFlow - Web Highlighter with Jump-Back | `MarkFlow – Web Highlighter & Notes with Jump-Back` |

### 3.2 canonical + hreflang（两页 head 新增）

zh 页（`https://flow.soulboy.site/`）：

```html
<link rel="canonical" href="https://flow.soulboy.site/" />
<link rel="alternate" hreflang="zh-CN" href="https://flow.soulboy.site/" />
<link rel="alternate" hreflang="en" href="https://flow.soulboy.site/lang/en/" />
<link rel="alternate" hreflang="x-default" href="https://flow.soulboy.site/" />
<meta property="og:locale:alternate" content="en_US" />
```

en 页（`https://flow.soulboy.site/lang/en/`）镜像：canonical → `/lang/en/`，同一组 alternate，`og:locale:alternate` → `zh_CN`。

### 3.3 JSON-LD `SoftwareApplication`（两页 head 各一段）

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "MarkFlow",
  "description": "…（与该页 meta description 同源：zh/en 各自语言，降调版）",
  "applicationCategory": "BrowserApplication",
  "operatingSystem": "Any",
  "url": "https://flow.soulboy.site/",
  "image": "https://flow.soulboy.site/og-image.png",
  "inLanguage": "zh-CN"（en 页 "en"）,
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "featureList": [
    "按住 Alt 划词高亮网页文本 / Hold Alt to highlight text",
    "点击笔记回跳原文位置 / Click a note to jump back to the source",
    "标签归类与章节大纲 / Tag-based organization and structured outlines",
    "数据仅存本地，可选 GitHub Gist 同步 / Local-first storage with optional Gist sync"
  ]
}
```

- `operatingSystem: "Any"`：浏览器扩展跨 OS，字段语义为操作系统而非浏览器（浏览器归属 `applicationCategory: BrowserApplication`）
- `featureList` 双语并列（两页各自语言为主、另一语言为辅），自然覆盖长尾词（roadmap §7 P1 前置铺垫）

### 3.4 `sitemap.xml` 重写（7 URL）

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <!-- / 与 /lang/en/ 两条：互带 3 组 xhtml:link alternate（zh-CN/en/x-default），lastmod 2026-09-11，priority 1.0/0.9 -->
  <!-- /try/（0.6）、/try/b.html、/try/c.html、/try/d.html（0.4，lastmod 同日，changefreq monthly） -->
</urlset>
```

## 4. 验证

- **静态断言**（脚本或逐项 grep）：两页 head 含 canonical / 3 条 alternate / 1 段 `ld+json`；title 与 OG 三处一致
- **JSON-LD 结构**：`JSON.parse` 校验通过、必填字段齐全（上线后可手动过 Google Rich Results Test）
- **sitemap**：XML 良构；URL 清单与站内链接逐一核对（无 301 形态差）
- **上线后（Driver 手动，非本 spec 范围）**：GSC 提交 sitemap（roadmap §7 衡量闭环的前置）

## 5. 变更文件清单

| 文件 | 变更 |
| :--- | :--- |
| `docs/index.html` | title 三处 + canonical/hreflang 4 行 + og:locale:alternate + JSON-LD |
| `docs/lang/en/index.html` | 同上（en 版） |
| `docs/sitemap.xml` | 重写：7 URL + alternates |
| `docs/NIT_ROADMAP.md` | §7 该行完成后转正 [已完成] |

## 6. 不做的事（YAGNI）

- 不做 robots.txt（无 disallow 需求）
- 不做 try 页 hreflang / JSON-LD
- 不做 sitemap 生成脚本
- 不动正文文案与 OG 图片
- 不动 `docs/try/` 正文（只受益于 sitemap 收录）
