# 宣传片录制管线 L1/L0 分离（Promo Engine Extraction）Design

## Goal

把 `scripts/promo-video/` 中**产品无关**的录屏引擎抽取为 L1（`engine/` 子目录），MarkFlow 专属内容（分镜表/舞台页/设置注入）留在 L0 适配器 `record.mjs`；SKILL.md 从「指向具体实现」改为「指向引擎 + 标定指南」。使第二个产品复用时只需重写适配器，不重写引擎、不重新踩坑。

## Approach

### 目标结构

```
scripts/promo-video/
  engine/                    # L1：零产品耦合，可直接搬走
    webm-concat.mjs          # 原样移入（demux/encodeSegment/remuxConcat/renderVideo）
    frame-detect.mjs         # decodePng + detectGraySpans（阈值全参数化，见下）
    ffmpeg.mjs               # 内置 ffmpeg 定位（原 record.mjs 的 FFMPEG IIFE）
  record.mjs                 # L0：MarkFlow 适配器（TEXT/BEATS/舞台页/注入/节拍编排）
  pages/                     # L0：舞台页，不动
  spike.mjs                  # 不动
```

### 参数化设计（frame-detect.mjs）

`detectGraySpans(videoFile, startMs, endMs, calib)`，新增 `calib` 对象（MarkFlow 现值作为缺省示例写入 JSDoc，**不写进引擎**）：

| 参数 | 现硬编码值 | 含义 |
| :--- | :--- | :--- |
| `grayPoints` | `[[120,260],[240,260],[360,260]]`（480×270 坐标系） | 灰带采样点（归一化坐标 × 缩放后尺寸换算） |
| `grayTolerance` | `±7` around 127 | 纯灰判定容差 |
| `tornThreshold` | `< 100` | 右下四分位均亮度阈值（依赖背景亮度 ~243） |
| `bgBrightness` | 243 | 内容底色亮度（用于文档说明阈值怎么定） |
| `fps / scale` | `20 / 480:270` | 抽帧密度与降采样 |
| `expandFrames` | `3` | 坏窗前后扩帧数 |
| `minSpanMs` | `80` | 最短坏窗 |

### 改动清单

1. **移动**：`webm-concat.mjs` → `engine/`（内容不改）；`record.mjs` 中 `decodePng`/`detectGraySpans`/ffmpeg 定位三块抽出到 `engine/frame-detect.mjs` + `engine/ffmpeg.mjs`，逻辑逐行保留，只加 `calib` 参数。
2. **适配**：`record.mjs` 改为 `import` 引擎，传入 MarkFlow 标定值（采样点/阈值作为 L0 常量定义在 record.mjs 顶部）。
3. **SKILL.md 更新**（三处）：
   - 参考实现路径：`webm-concat.mjs` → `engine/` 下新路径
   - 通用性地图：「直接搬走」行指向 `engine/` 整体
   - 新增小节「标定指南」：采样点怎么选（舞台底部署于永不为内容灰的位置）、底色亮度怎么测（抽一帧量背景）、settle/扩帧缺省值及调大条件
4. **lint 豁免确认**：`engine/*.mjs` 沿用现有 scripts 豁免块（坑 #9 的第二个独立 config 参数），如有遗漏补上。

### 验证（三层）

- L1 自动化：`npm run lint` / type-check 0 errors
- L2 计算型：
  - 引擎 smoke test（$TMPDIR，动画页录 3s → 抽帧 → decodePng → renderVideo 拼接，沿用已验证脚本）
  - **完整回归**：`node scripts/promo-video/record.mjs zh` 端到端 exit 0，产出时长与现有 `assets/markflow-promo.webm` 对齐（±节拍可解释范围），灰带检测结果与重构前一致
- L3 推理型：按 SKILL 人工优先约定，重录成片交由 Driver 完整观看确认无回归，AI 不做全量抽帧

## References

- 引擎源：`scripts/promo-video/record.mjs:54-136`（decodePng + detectGraySpans）、`39-44`（ffmpeg 定位）
- 零耦合模块：`scripts/promo-video/webm-concat.mjs`（全文）
- SKILL 待改节：`skills/custom/promo-video-recording/SKILL.md` 参考实现表、通用性地图、坑 #5
- lint 豁免（坑 #9）：`eslint.config.mjs` 第二个独立 config 参数的 ignores 块

## Boundaries

- **只重构，不改行为**：节拍、文案、hammer 策略、切窗逻辑一行不动；产出视频应与重构前等价（重编码 md5 不同属正常）
- 抽成独立 npm 包 / 上提 SOP-HOME：**不做**（无第二个产品验证接口，属于过度设计）
- 不碰 `pages/`、`spike.mjs`、扩展构建产物
- 缺失的 `notes/ai-recorded-promo-video-retro.md`（gitignored）不重建；SKILL 引用该文档处保持原样
- 完整重录回归仅跑 zh 单语言（en 平行录制同一份代码路径，冒烟覆盖即可）；重录产物**覆盖前**先备份现有 `assets/markflow-promo.webm` 至 $TMPDIR 以便回滚
- 改动文件预估 5 个（engine 新增 3 + record.mjs + SKILL.md，±eslint.config）
