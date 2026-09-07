# 侧边栏标题交互与网页标题修复 Surgical Plan

> **For AI:** REQUIRED SUB-SKILL: Load `superpowers:executing-plans` skill.

**Goal:** 三级标题行多击禁选 + 网页层级标题显示真实页面标题（展示层修复 + 旧数据回填）。
**Architecture:** 视图层加 `select-none` 工具类；`tagTree` 取首个有 title 的标记；restorer 复用 `update-mark-details` 幂等回填。

**Spec:** `docs/superpowers/specs/2026-09-07-sidepanel-title-interaction-design.md`(Driver 已批准)

## Execution Plan

```yaml
tasks:
  - id: "001"
    subject: "三级标题行 select-none(标签/网页/章节/标记)"
    slug: "title-rows-select-none"
    type: "impl"
    depends-on: []
  - id: "002"
    subject: "tagTree pageTitle 取首个有 title 的标记 + 单测"
    slug: "tagtree-title-fallback"
    type: "impl"
    depends-on: []
  - id: "003"
    subject: "restorer 旧数据 title 回填 + 单测 + 三层验证"
    slug: "restorer-title-backfill"
    type: "impl"
    depends-on: ["002"]
```

**Task File References:**

- Task 001: `001-title-rows-select-none.md`
- Task 002: `002-tagtree-title-fallback.md`
- Task 003: `003-restorer-title-backfill.md`
