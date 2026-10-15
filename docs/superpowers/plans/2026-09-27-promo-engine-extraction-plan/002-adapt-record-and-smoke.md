# Task 002: record.mjs 适配 import + calib 常量上移 + 引擎 smoke test

## Context

Task 001 后引擎已就位但无人使用。本任务把 `record.mjs` 改为 import 引擎，MarkFlow 标定值作为 L0 常量定义在 record.mjs 顶部；删除已抽走的 `decodePng`/`detectGraySpans`/ffmpeg IIFE。随后用 $TMPDIR smoke test 黑盒验证引擎 API。

## Target Logic

### record.mjs 改动（仅四处，其余一行不动）

1. **import 替换**（文件头）：

```js
import { findBundledFfmpeg } from './engine/ffmpeg.mjs'
import { detectGraySpans } from './engine/frame-detect.mjs'
// zlib 若仅剩 decodePng 使用则一并删除 import
```

2. **FFMPEG IIFE → 调用**：`const FFMPEG = findBundledFfmpeg(ROOT)`

3. **calib 常量**（L0 持有，写在 TEXT 表附近）：

```js
/* MarkFlow 舞台标定（纸底 #f5f2ec 亮度 ~243；采样点位于底部灰带区、永不为内容灰） */
const DETECT_CALIB = {
  grayPoints: [[120, 260], [240, 260], [360, 260]],
  tornThreshold: 100,
  // 其余用引擎缺省
}
```

4. **调用点适配**（约 598 行）：

```js
const graySpans = detectGraySpans(f0, { ffmpeg: FFMPEG, tmpDir: TMP_DIR, startMs: t0Start, endMs: t0End, calib: DETECT_CALIB })
```

5. **删除**：`decodePng`、`detectGraySpans` 原实现（54-136 行）、旧 FFMPEG IIFE；`webm-concat` import 路径改为 `./engine/webm-concat.mjs`。

### 引擎 smoke test（$TMPDIR，不进仓库）

复用已验证脚本（`/var/folders/.../T/opencode/promo-smoke/smoke.mjs` 模式）：动画页录 3s → 引擎 `findBundledFfmpeg` 定位 ffmpeg → 抽帧 → `decodePng` 解码采样 → `renderVideo` 两段裁剪拼接。断言四点全 PASS。完事 `rm -rf`。

## Verification

```bash
node -c "syntax check" # node --check scripts/promo-video/record.mjs
node /var/folders/.../T/opencode/promo-smoke/smoke.mjs  # 4× PASS，临时目录已清
```

（smoke test 不跑 record.mjs 主流程——全量回归在 Task 003。）
