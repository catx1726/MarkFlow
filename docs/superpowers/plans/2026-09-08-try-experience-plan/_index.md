# 体验页组（docs/try/）实施计划

> **For AI:** REQUIRED SUB-SKILL: Load `superpowers:executing-plans` skill.

**Goal:** 新增免安装体验页组（5 页 A~E + try.css + try.js），纯 JS 复刻扩展「标记 → 标签归类 → 回跳」闭环；落地页 hero 加「体验」入口。
**Architecture:** 零构建静态页（Tailwind CDN 沿用）；`try.js` 单文件引擎按职责分模块（store/anchor/render/tooltip/sidebar/jump/hint）；`localStorage['markflow-try-marks']` 结构镜像 `marks-by-url-storage`；锚点 = 段落索引 + 文本偏移（静态内容足够稳定）。

**Spec:** `docs/superpowers/specs/2026-09-08-try-experience-pages-design.md`（Driver 已批准）
**Issue:** #83

## Execution Plan

```yaml
tasks:
  - id: "001"
    subject: "共享骨架 + try.css + 页面 A（docs/try/index.html）"
    slug: "shell-and-page-a"
    type: "impl"
    depends-on: []
  - id: "002"
    subject: "try.js 模拟引擎（标记/标签/侧栏/回跳/重置）"
    slug: "try-engine"
    type: "impl"
    depends-on: ["001"]
  - id: "003"
    subject: "内容页 B~E（b/c/d/e.html）+ 跨页回跳联调"
    slug: "content-pages-b-e"
    type: "impl"
    depends-on: ["002"]
  - id: "004"
    subject: "落地页「体验」入口 + 三层验证走查"
    slug: "landing-entry-and-verify"
    type: "test"
    depends-on: ["003"]
  - id: "005"
    subject: "范围修订：去标签 + 快捷键 + 说明弹窗 + 页面文件夹层级 + 移除 E 页"
    slug: "scope-revision"
    type: "impl"
    depends-on: ["004"]
```

**Task File References:**

- Task 001: `001-shell-and-page-a.md`
- Task 002: `002-try-engine.md`
- Task 003: `003-content-pages-b-e.md`
- Task 004: `004-landing-entry-and-verify.md`
- Task 005: `005-scope-revision.md`（2026-09-08 Driver 指令，见 Spec 修订记录）

## 内容选段契约（实施时机械取材，来源：Driver 笔记原文）

| 页 | 章节标题 | 必含选段（首句锚定） |
| :--- | :--- | :--- |
| A | 让内在来指挥 | 「让内在来指挥。我很清楚……」/「只有人物内部心结的产生与和解……」/「事实上，电影就是朝向未知的迈进……」 |
| B | 以手、物件和眼神为主题的电影 | 「我希望拍一部以手、物件和眼神为主题的电影……」/「我摄取现实，现实的碎片……」/「在现实生活中，我们四分之三的行为甚至话语都是无意识的……」/「节奏源于精确：一个东西是这样……」 |
| C | 触及神秘 | 「换句话说我寻找的不是完美的影像，而是必要的影像……」/「我想触及……每件事情里都隐藏着神秘……」/「电影不是由影像构成的，而是由影像之间的关系构成的……」/「两个东西越是相似，就越不相同……」 |
| D | 诗歌与真实是姐妹 | 「人们不知道创造首先就是删减、剔除……」/「因为诗歌与真实是姐妹……」/「剪辑就是归位……」/「我相信无意识行为……不去想你们在做什么……」 |

（修订：E「个人总结」页已随 005 移除，页签 A~E 改为 A~D。）
