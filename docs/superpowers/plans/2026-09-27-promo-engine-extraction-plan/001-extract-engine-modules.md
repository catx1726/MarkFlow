# Task 001: 抽取 engine/ 三个模块

## Context

`record.mjs` 中三块产品无关逻辑埋在 625 行产品代码里：ffmpeg 定位（39-44 行）、`decodePng`（54-90 行）、`detectGraySpans`（97-136 行）。`webm-concat.mjs` 已零耦合但路径与产品脚本混在一起。目标：抽到 `scripts/promo-video/engine/`，阈值参数化。

## Target Logic

### 1. `engine/webm-concat.mjs` — 原样移动

```bash
git mv scripts/promo-video/webm-concat.mjs scripts/promo-video/engine/webm-concat.mjs
```

内容一行不改（导出 `demuxWebm/encodeSegment/remuxConcat/renderVideo` 不变）。

### 2. `engine/ffmpeg.mjs` — ffmpeg 定位

从 record.mjs 39-44 行抽取，逻辑不变，参数化项目根：

```js
export function findBundledFfmpeg(rootDir) {
  const dir = path.join(rootDir, 'node_modules/playwright-core/.local-browsers')
  const d = fs.readdirSync(dir).find(d => d.startsWith('ffmpeg-'))
  if (!d) throw new Error('内置 ffmpeg 未安装：npx playwright install ffmpeg')
  return path.join(dir, d, 'ffmpeg-mac')
}
```

### 3. `engine/frame-detect.mjs` — decodePng + 参数化 detectGraySpans

- `decodePng`：从 record.mjs 54-90 行**逐行照搬**，原样导出。
- `detectGraySpans(videoFile, { ffmpeg, tmpDir, startMs, endMs, calib })`：从 97-136 行抽取，硬编码值全部进 `calib`：

```js
/**
 * calib 标定对象（缺省值即 MarkFlow 实测值，换产品需重新标定，见 SKILL「标定指南」）：
 * {
 *   grayPoints: [[120,260],[240,260],[360,260]], // 灰带采样点，基于 scaleW×scaleH 坐标系
 *   grayCenter: 127, grayTolerance: 7,           // 纯灰 #808080 ± 容差
 *   tornThreshold: 100,                          // 右下四分位均亮度阈值（底色亮度 ~243 时安全）
 *   fps: 20, scaleW: 480, scaleH: 270,           // 抽帧密度与降采样
 *   expandFrames: 3,                             // 坏窗前后扩帧
 *   minSpanMs: 80,                               // 最短坏窗
 * }
 */
```

行为约束：

- ffmpeg 调用参数保持 `-ss -t -r -frames:v -vf scale=`（坑 #1：禁 `-to`）
- 采样点判定逻辑（三点同灰）、撕裂帧右下四分位（0.75 起、步长 2）逐行保留
- 临时扫描目录在函数内 `fs.rmSync` 清理（现状如此，保留）
- `tmpDir` 由调用方传入（函数不自建父目录）

## TDD

本任务为纯移动+参数化重构，无新行为；验证靠 Task 002 的 smoke test（对引擎 API 的黑盒测试）。不新增单测（项目对 scripts/ 无单测设施，SKILL 工具脚本豁免 lint）。

## Verification

```bash
node -e "import('./scripts/promo-video/engine/frame-detect.mjs').then(m => console.log(typeof m.decodePng, typeof m.detectGraySpans))"
node -e "import('./scripts/promo-video/engine/webm-concat.mjs').then(m => console.log(typeof m.renderVideo))"
node -e "import('./scripts/promo-video/engine/ffmpeg.mjs').then(m => console.log(m.findBundledFfmpeg(process.cwd())))"
```

三条均正常输出即通过（此时尚未改 record.mjs，仓库处于可运行的中间态）。
