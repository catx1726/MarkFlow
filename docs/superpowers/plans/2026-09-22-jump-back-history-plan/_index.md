# Jump Back History Surgical Plan

> **For AI:** REQUIRED SUB-SKILL: Load `superpowers:executing-plans` skill.

**Goal:** 侧边栏新增「返回」按钮，点击标记跳转原文后可逐级回退到跳转前位置（多级栈，仅同标签页）。
**Architecture:** content script 内存栈（`jumpHistory.ts`）在 `scrollToMark` 滚动前捕获视口+可滚动祖先位置；侧边栏通过 `jump-back` / `get-jump-history-depth` 消息驱动回退与按钮状态。

设计依据： `docs/superpowers/specs/2026-09-22-jump-back-history-design.md`

## Execution Plan

```yaml
tasks:
  - id: "001"
    subject: "JumpHistoryManager 模块（TDD：单测先行）"
    slug: "jump-history-manager"
    type: "impl"
    depends-on: []
  - id: "002"
    subject: "协议与 content script 接线（shim.d.ts + restorer 捕获钩子 + onMessage）"
    slug: "wire-content-script"
    type: "impl"
    depends-on: ["001"]
  - id: "003"
    subject: "侧边栏返回按钮（useJumpBack + SidepanelHeader UI + i18n）"
    slug: "sidepanel-back-button"
    type: "impl"
    depends-on: ["002"]
```

**Task File References:**

- Task 001: `001-jump-history-manager.md`
- Task 002: `002-wire-content-script.md`
- Task 003: `003-sidepanel-back-button.md`
