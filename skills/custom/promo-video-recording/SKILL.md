---
name: promo-video-recording
description: Use when recording, diagnosing, or surgically re-cutting product promo/demo videos via Playwright screencast (real browser extension, staged pages, webm output) with the Playwright-bundled stripped ffmpeg. Covers pipeline architecture, gray-band/torn-frame artifacts, frame-level cuts, and the human-first verification protocol.
---

# 宣传片 AI 录制与修复 (Promo Video Recording)

## Overview

用 Playwright 驱动**真实产品**（非 mock）在受控舞台页上完成操作并录屏，产出宣传片 webm。
本技能沉淀自 MarkFlow 双语宣传片实战（`scripts/promo-video/`，commit 3f099db 起），
回答两个问题：**怎么录**、**哪些部分可以搬走通用**。

参考实现（本仓库）：
- `scripts/promo-video/engine/` — L1 引擎（零产品耦合）：`webm-concat.mjs`（帧级裁剪+无损拼接 renderVideo）、
  `frame-detect.mjs`（decodePng + 参数化 detectGraySpans）、`ffmpeg.mjs`（内置 ffmpeg 定位）
- `scripts/promo-video/record.mjs` — L0 适配器：MarkFlow 分镜表/舞台编排/设置注入 + DETECT_CALIB 标定常量
- `scripts/promo-video/pages/` — 舞台页（rec.js 覆盖层：字幕/虚拟光标/键帽/zoom）
- `notes/ai-recorded-promo-video-retro.md` — 调研与完整复盘（gitignored）

---

## When to Use

- [ ] 要给浏览器扩展 / Web 产品录制实机演示视频（README、落地页、商店页）
- [ ] 要诊断/修复已有 webm 录屏的缺陷（灰带、撕裂、冻结、接缝跳变）
- [ ] 要做帧级精确的视频切除/拼接，且环境只有 Playwright 内置裁剪版 ffmpeg

**不触发**：真人录屏后期（选 Screen Studio/Clueso）、需要配音配乐（本管线无音频）。

---

## 工作流约定（Driver 裁定，最高优先级）

> **录屏结束后 AI 不立即抽帧检测。先由人完整观看成片；人指出问题后，AI 再做定向帧级验证。**

理由：全量抽帧分析 CPU 密集（发热）、耗时长，而绝大多数缺陷人眼一遍即可定位。
AI 的验证动作只在人工发现问题后启动，且按「验证协议」节定向执行（低分辨率、单趟、连续解码）。

---

## 通用性地图：哪些能搬走，哪些必须重写

| 模块 | 耦合度 | 复用方式 |
| :--- | :--- | :--- |
| `engine/webm-concat.mjs`（renderVideo/encodeSegment/remuxConcat） | **零** | 直接搬走。任何 webm 的帧级切除/多段拼接 |
| `engine/frame-detect.mjs`（decodePng + detectGraySpans）+ `engine/ffmpeg.mjs` | **零** | 直接搬走。纯 JS，依赖只有 zlib；阈值经 calib 参数传入（标定方法见「标定指南」） |
| Playwright 加载真实扩展（`launchPersistentContext` + `--load-extension`） | 低 | 抄模式，改扩展路径 |
| 静态服务器、WAR patch（sidepanel iframe 嵌入） | 低 | 抄模式（见 record.mjs），改资源清单 |
| 设置/语言注入钩子 | 半 | L0 示例见 record.mjs；抽象为"前置钩子"；**必须写全量默认值**（见坑 #4） |
| TEXT 文案表 + BEATS 节拍 + 选择器 + DETECT_CALIB | **强** | 每个产品重写。分镜表是创作不是工程；CALIB 按「标定指南」测定 |
| 舞台页 `pages/`（排版、覆盖层、rec.js） | 强 | rec.js 覆盖层思想可搬（字幕/假光标/键帽/DOM zoom），内容页重写 |

> 结论：约 60% 代码产品无关，已分离为 `engine/`（L1）；复盘文档 §5 的完整通用化路径（独立成包等）暂不推进——无第二个产品验证接口前属于过度设计。

---

## 录制管线怎么搭（从零到一）

```
1. 舞台页：静态 HTML 自排版式（不依赖外网），注入 rec.js 覆盖层
   —— 字幕 pill / 虚拟光标(DOM 元素，headless 无系统光标) / 键帽回显 / DOM 级 zoom(fit/focus)
2. 真实扩展：chromium.launchPersistentContext({ channel:'chromium', headless:true,
   args:[--load-extension=构建产物], recordVideo:{ dir, size } })
   —— headless shell 不支持扩展；branded Chrome ≥152 禁用 --load-extension；必须 channel:'chromium'
   —— 录屏组件装项目内：PLAYWRIGHT_BROWSERS_PATH='0'（在 require 前设置）
3. 前置注入：语言/设置走扩展自身存储（见坑 #4），不是浏览器 flag
4. 节拍执行：beats = 声明式分镜表（操作+停顿+字幕文案），改节奏=改数组
5. 多 tab = 多轨：跨页跳转产生新 tab，每 tab 一条独立 webm，最后拼接
6. 出片：detectGraySpans 帧级检测坏窗 → renderVideo 重编码裁剪+remux 拼接
7. 兜底：try/finally 关 context、清 TMP_DIR（浏览器子进程不随 shell 退出而消亡）
```

双语/多语言 = **平行录制**：同一份 beats + 文案表切换，跑两遍出两条成片，不是后期翻译。

---

## 坑（每条都是实测踩出来的）

1. **Playwright 产出的 webm 时间戳不规律，ffmpeg `-to` 不可信**（实测 4 分钟视频按 `-to` 抽出 1.9 万帧）。
   一律 `-t 时长` + `-frames:v 硬上限` + `-vf scale=` 先降采样再分析。
2. **`-ss` 单点 seek 有 artifact，不能用于验证**。验证接缝/播放效果必须 `-ss X -t Y` **连续解码**一个区间看序列帧。
   （曾因此误判接缝"无痕"，实际是有损跳变。）
3. **灰带（#808080 未栅格化瓦片）无银弹，三层纵深防御**：
   ① 重锤 `setViewportSize` 抖 1px 逼合成器重排；② 录后逐窗检测自动切除；③ 落锤后该 tab 禁 zoom 过渡 + ≥1.2s settle。
   ⚠️ 重锤副作用：随后 ~2s 内偶发**撕裂帧**（帧几何突变：内容缩左上、右下纯黑）。
   落锤与下一次操作之间留足 settle（≥1.2s），使迟到的错乱帧落在静态画面/将被切除的窗口内。
4. **`--lang` 影响不了 `chrome.i18n.getUILanguage()`**（跟随操作系统）。多语言录制要走扩展自身设置存储注入。
   且 `useWebExtensionStorage` 默认 `mergeDefaults=false`：**必须写全量默认值**，只写字段差量会让其余字段变 undefined、功能静默失灵。
5. **Playwright 内置 ffmpeg 是裁剪版**：只有 matroska demuxer / webm muxer / png encoder / image2 muxer / libvpx / scale,crop,pad filter。
   **没有** concat、freezedetect、fps filter（`fps=1` 报 Invalid argument，用 `-r 1`）、rawvideo、mjpeg。
6. **screencast VP8 关键帧极稀疏（~5s 一个），remux 裁剪无法帧级精确**。
   两段式：先 `ffmpeg -ss/-t -c:v libvpx` 重编码出独立段（天然关键帧开头），再纯 JS remux（ts-ebml 解包 + webm-muxer 重排时间戳）。
7. **合成键盘事件可替代真实按键**：headless 下真实 Alt+S 偶发不触发扩展 handler（事件已到页面），
   `dispatchEvent(new KeyboardEvent(...))` 走同一 handler 且对镜头不可见。
8. **划词验证**：扩展预览会包 span 破坏原生选区，不能用 getSelection 验证；以 UI 反馈元素（如 Tooltip 出现 + 预览文本）为准。
9. **工具脚本被 lint-staged 误伤**：eslint flat config 用**第二个独立 config 参数**的纯 ignores 块豁免，`antfu({ignores})` 首参不生效。
10. **工程卫生**：见根 `AGENTS.md` 会话卫生节（nohup+轮询、按进程树杀、$TMPDIR 手动清、发热控制）。

---

## 标定指南（换产品时为 engine/frame-detect.mjs 测定 calib）

引擎缺省值即 MarkFlow 实测值；换舞台底色/版式后必须重新标定，否则灰带漏检或内容帧误伤。

1. **grayPoints（灰带采样点）**：抽一帧已知正常画面（`-ss X -t 0.5 -vf scale=480:270 -frames:v 1`），
   在底部区域选 3 个**永不被内容覆盖**的坐标（避开字幕 pill、光标、键帽的出现范围），
   横向分散（如 1/4、1/2、3/4 处），纵坐标贴近底边。MarkFlow：底部 260/270 行。
2. **tornThreshold（撕裂帧阈值）**：量正常帧右下四分位背景亮度（MarkFlow 纸底 #f5f2ec ≈ 243），
   阈值取背景亮度的 ~40%（243 → 100）。暗底舞台此判定失效，需换判据（如边缘能量突降）。
3. **settle ≥1.2s、expandFrames=3** 为实测缺省；若重锤后仍见迟到错乱帧落在切窗外，
   先加 settle（操作前等待），再加 expandFrames（切窗扩大）。
4. 标定验证：先跑一遍 `detectGraySpans` 于**已知无缺陷**的片段，应返回空窗；
   再把 tornThreshold 调极端（如 255）确认能检出——双向证明参数生效（见 plan 002 smoke test）。

---

## 缺陷诊断与修复（验证协议）

人工发现异常后启动。原则：**低分辨率、单趟串行、连续解码、完事即清**。

### 缺陷类型谱与判定

| 缺陷 | 特征 | 检测方法 |
| :--- | :--- | :--- |
| 灰带 | 底部连续纯灰 #808080 | 多点采样同时为灰（±7） |
| 撕裂帧 | 帧几何突变，右下四分位纯黑 | 右下四分位均亮度 < 100（纸底恒 ~243） |
| 孤立坏帧 | 单帧异常，前后邻居一致 | dPrev>阈值 && dNext>阈值 && dSkip≈0 |
| 冻结区 | 相邻帧 diff≈0 的连续段 | screencast 无变化不出帧是**正常节拍**；先对照同编排的其他语言版本判定"设计 vs 过长"（参考：节拍静区 ≤2s 属正常） |
| 接缝跳变 | 切点两侧内容突变 | 连续解码接缝 ±0.5s 区间序列帧目检 |

### 全帧率扫描（无外部依赖）

- 内置 ffmpeg 抽 PNG 序列：`-vf scale=160:90` + image2（**无 rawvideo/png parser，只能落盘 PNG 序列**）
- Node 内置 zlib 手写 PNG 解码（`engine/frame-detect.mjs` `decodePng`：IHDR/IDAT/inflate/5 种 scanline filter）
- 逐帧算：全局亮度、右下四分位亮度、相邻帧 diff → 输出异常帧 + 静区图

### 手术刀：renderVideo 帧级切除

```js
renderVideo(ffmpeg, [{ file, startMs, endMs }, { file, startMs }], outFile, workDir)
// workDir 必须已存在（函数不自建）；单文件多段 = 切除中间窗口
```

### 切点三定律（EN 撕裂帧修复实战教训）

1. **落在实心帧**：字幕 fade 完毕、无 zoom/几何过渡进行中、无残影。切进字幕淡入中途 = 残影帧接缝，肉眼即"花屏"。
2. **几何断点不可缝**：录制编排中 zoom/fit 变化点两侧的几何不同，任何跨点拼接都是跳变——切窗必须**整个覆盖**过渡区，或把切点设计成"节拍硬切"（字幕实心→字幕实心，观众读作设计好的切换）。
3. **对照母版**：多语言平行录制时，用无缺陷语言版本定义"这个节拍本该长什么样"，再决定切窗。

### 修复后验证清单

- [ ] 全帧率（25fps）扫描：撕裂/黑帧/孤立坏帧 = 0
- [ ] 静区图：无超长冻结（对照母版节拍）
- [ ] 接缝 ±0.5s 连续解码序列帧目检（**禁用 `-ss` 单点 seek**）
- [ ] 时长与母版对齐（节拍删减量可解释）
- [ ] 多副本同步替换（如 docs/ 与 assets/），md5 校验一致

---

## Red Flags

- ❌ 录完立即自动全量抽帧检测（违反人工优先约定）
- ❌ 用 `-ss` 单帧截图下"接缝无痕/播放正常"的结论
- ❌ 用 `-to`、`fps=` filter、freezedetect、concat demuxer（内置 ffmpeg 没有）
- ❌ 对冻结区一律当缺陷切除——先对照母版区分节拍设计
- ❌ 切点落在字幕淡入淡出/残影/几何过渡帧上
- ❌ 扩展设置注入只写差量字段（mergeDefaults=false 陷阱）
- ❌ 临时抽帧/中间产物留在仓库或 $TMPDIR 不清理
