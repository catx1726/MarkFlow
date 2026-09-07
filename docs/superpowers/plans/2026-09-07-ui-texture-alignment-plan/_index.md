# 自有页面质感对齐 Surgical Plan

> **For AI:** REQUIRED SUB-SKILL: Load `superpowers:executing-plans` skill.

**Goal:** Popup/Sidepanel 质感对齐宣传页布列松风（gray→neutral、去阴影、圆角收敛）+ 死 token 清理。
**Architecture:** 纯 class/CSS token 替换，零逻辑变更；沿用 2026-08-20 品牌色统一 Spec 的同明度词根替换法。

**Spec:** `docs/superpowers/specs/2026-09-07-owned-ui-texture-alignment-design.md`(Driver 已批准)

## Execution Plan

```yaml
tasks:
  - id: "001"
    subject: "Vue 组件质感 token 替换(7 文件)"
    slug: "vue-texture-tokens"
    type: "impl"
    depends-on: []
  - id: "002"
    subject: "main.css 滚动条 token 中性化 + unocss 死 token 清理"
    slug: "css-tokens-cleanup"
    type: "impl"
    depends-on: ["001"]
  - id: "003"
    subject: "三层验证(lint / test / build + grep 零残留)"
    slug: "verify"
    type: "test"
    depends-on: ["002"]
```

**Task File References:**

- Task 001: `001-vue-texture-tokens.md`
- Task 002: `002-css-tokens-cleanup.md`
- Task 003: `003-verify.md`
