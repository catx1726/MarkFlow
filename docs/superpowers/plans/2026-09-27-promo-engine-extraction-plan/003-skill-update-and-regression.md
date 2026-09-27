# Task 003: SKILL.md 更新 + lint 豁免确认 + zh 全量重录回归

## Context

代码分离完成后，SKILL.md 中「参考实现」「通用性地图」仍指向旧路径；缺失「标定指南」导致换产品时阈值无从定起。最后跑 zh 全量重录做行为回归。

## Target Logic

### 1. SKILL.md 三处更新

- **参考实现表**：`webm-concat.mjs` → `engine/webm-concat.mjs`；`record.mjs` 描述拆为「L0 适配器（分镜/舞台/注入）」+「L1 引擎（engine/）」
- **通用性地图**：「直接搬走」两行合并指向 `engine/` 目录；「设置/语言注入钩子」行注明属 L0 示例
- **新增小节「标定指南」**（放在「坑」与「缺陷诊断与修复」之间）：
  - `grayPoints` 怎么选：抽一帧已知正常画面，在底部区域选 3 个永不被内容覆盖的坐标（按 scaleW×scaleH 折算）
  - `tornThreshold` 怎么定：量正常帧背景亮度（MarkFlow 纸底 ~243），阈值取背景亮度的 ~40%
  - `settle ≥1.2s`、`expandFrames=3` 为实测缺省；若重锤后出现更多迟到错乱帧，先加 settle 再加扩帧

### 2. lint 豁免确认

检查 `eslint.config.mjs` 第二个独立 config 参数的 ignores 块是否覆盖 `scripts/promo-video/engine/`（应随 `scripts/**` 既有规则覆盖；若按文件列举则补上 engine 路径）。

### 3. ~~zh 全量重录回归~~（Driver 已取消：「不需要重新录制」）

行为等价性改由 Task 002 引擎 smoke test（5 项断言含参数化双向验证）+ `node --check` + lint 覆盖；
下次正式重录宣传片时自然完成端到端回归，届时按人工优先约定交 Driver 看片。

## Verification

```bash
npm run lint                    # 0 errors
git diff --stat                 # 改动文件 ≤6（engine×3 + record.mjs + SKILL.md ±eslint.config）
ls -la assets/markflow-promo.webm
```
