# Issue #91 Restore Throttle Surgical Plan

> **For AI:** REQUIRED SUB-SKILL: Load `superpowers:executing-plans` skill.

**Goal:** 消除打字触发的 300ms 循环全文搜索卡顿（issue #91），并为单次搜索建立成本上界。
**Architecture:** P0 在 restorer/state/monitor 三处统一失败冷却与输入过滤，使节流机制闭环；P1 在 search.ts 内做纯算法复杂度优化（缓存/索引/封顶/二分），不改对外接口。

## Execution Plan

```yaml
tasks:
  - id: "001"
    subject: "P0: 统一失败冷却 + 指数退避 + monitor 输入过滤"
    slug: "p0-unified-cooldown-input-filter"
    type: "impl"
    depends-on: []
  - id: "002"
    subject: "P1: search.ts 搜索成本上界（缓存/索引/封顶/二分/正则限界）"
    slug: "p1-search-cost-bound"
    type: "impl"
    depends-on: ["001"]
  - id: "003"
    subject: "增量恢复：monitor 收集 addedNodes 子树根，Phase2 仅对新增内容建 context"
    slug: "incremental-restore-scope"
    type: "impl"
    depends-on: ["001", "002"]
  - id: "004"
    subject: "测试补充：冷却/退避/输入过滤/增量断言 + 全量回归"
    slug: "tests-cooldown-input-filter"
    type: "test"
    depends-on: ["001", "002", "003"]
```

**Task File References:**

- Task 001: `001-p0-unified-cooldown-input-filter.md`
- Task 002: `002-p1-search-cost-bound.md`
- Task 003: `003-incremental-restore-scope.md`
- Task 004: `004-tests-cooldown-input-filter.md`

**Spec:** `docs/superpowers/specs/2026-10-15-issue-91-restore-throttle-design.md`
**Baseline:** restorer/monitor/search/state specs — 33 passed / 1 skipped / 0 failed (2026-10-15)
