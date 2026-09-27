# Promo Engine Extraction Surgical Plan

> **For AI:** REQUIRED SUB-SKILL: Load `superpowers:executing-plans` skill.

**Goal:** 把 `scripts/promo-video/` 中产品无关的录屏引擎抽取为 L1（`engine/`），MarkFlow 适配器 `record.mjs` 改为 import 引擎；SKILL.md 指向引擎并补标定指南。行为零变化。

**Architecture:** `engine/webm-concat.mjs`（原样移动）+ `engine/ffmpeg.mjs`（ffmpeg 定位）+ `engine/frame-detect.mjs`（decodePng + 参数化 detectGraySpans）；L0 `record.mjs` 持有 MarkFlow 标定常量。

设计依据： `docs/superpowers/specs/2026-09-27-promo-engine-extraction-design.md`

## Execution Plan

```yaml
tasks:
  - id: "001"
    subject: "抽取 engine/ 三个模块（webm-concat 移动、ffmpeg 定位、frame-detect 参数化）"
    slug: "extract-engine-modules"
    type: "impl"
    depends-on: []
  - id: "002"
    subject: "record.mjs 适配 import + calib 常量上移 + 引擎 smoke test"
    slug: "adapt-record-and-smoke"
    type: "impl"
    depends-on: ["001"]
  - id: "003"
    subject: "SKILL.md 更新 + lint 豁免确认 + zh 全量重录回归（含备份/回滚）"
    slug: "skill-update-and-regression"
    type: "impl"
    depends-on: ["002"]
```

**Task File References:**

- Task 001: `001-extract-engine-modules.md`
- Task 002: `002-adapt-record-and-smoke.md`
- Task 003: `003-skill-update-and-regression.md`
