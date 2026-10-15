/**
 * 帧级坏窗检测（L1 引擎，产品无关）
 *
 * decodePng：极简 PNG 解码（8-bit RGB/RGBA，无隔行），依赖只有 Node 内置 zlib。
 * detectGraySpans：扫描 videoFile 的 [startMs, endMs]，返回坏帧时间窗 [[s,e],…]（毫秒）。
 *   坏帧两类：①底部纯灰带（采样点同时为灰）②撕裂帧（视口在录制中 resize 导致帧几何
 *   突变，内容缩进左上、右下四分位纯黑——亮底内容帧该区域恒亮，阈值安全）。
 *
 * 注意：Playwright 产出的 webm 时间戳不规律，-to 可能失效导致全片抽帧（实测 4 分钟
 * 视频抽出 1.9 万帧 4K PNG）。故：-t 限时长 + -frames:v 硬上限 + 先降采样再解码。
 *
 * calib 标定对象（缺省值即 MarkFlow 实测值；换产品须重新标定，方法见
 * skills/custom/promo-video-recording/SKILL.md「标定指南」）。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

/** 极简 PNG 解码（8-bit RGB/RGBA，无隔行）：返回 { w, h, bpp, data } */
export function decodePng(file) {
  const d = fs.readFileSync(file)
  let pos = 8, w = 0, h = 0, bpp = 3
  const idat = []
  while (pos < d.length) {
    const ln = d.readUInt32BE(pos)
    const typ = d.toString('ascii', pos + 4, pos + 8)
    if (typ === 'IHDR') {
      w = d.readUInt32BE(pos + 8); h = d.readUInt32BE(pos + 12)
      bpp = d[pos + 8 + 9] === 6 ? 4 : 3 // colortype 6=RGBA 2=RGB
    } else if (typ === 'IDAT') idat.push(d.subarray(pos + 8, pos + 8 + ln))
    else if (typ === 'IEND') break
    pos += 12 + ln
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const data = Buffer.alloc(h * stride)
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const prev = y ? data.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride)
    const out = data.subarray(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0
      out[x] = f === 1 ? (row[x] + a) & 255
        : f === 2 ? (row[x] + b) & 255
        : f === 3 ? (row[x] + ((a + b) >> 1)) & 255
        : f === 4 ? (row[x] + paeth(a, b, c)) & 255
        : row[x]
    }
  }
  return { w, h, bpp, data }
}

const DEFAULT_CALIB = {
  grayPoints: [[120, 260], [240, 260], [360, 260]], // 灰带采样点（scaleW×scaleH 坐标系）
  grayCenter: 127, // 纯灰 #808080
  grayTolerance: 7, // 灰判定容差
  tornThreshold: 100, // 右下四分位均亮度阈值（底色亮度 ~243 时安全）
  fps: 20, // 抽帧密度
  scaleW: 480, // 降采样宽
  scaleH: 270, // 降采样高
  expandFrames: 3, // 坏窗前后扩帧（采样间隔内可能漏灰帧）
  minSpanMs: 80, // 最短坏窗
}

/** 扫描 videoFile 的 [startMs, endMs]，返回坏帧时间窗 [[s,e],…]（毫秒）
    opts: { ffmpeg, tmpDir, startMs, endMs, calib } —— tmpDir 必须已存在（函数不自建父目录，
    但会在其中创建并清理自己的扫描子目录）。 */
export function detectGraySpans(videoFile, { ffmpeg, tmpDir, startMs, endMs, calib = {} }) {
  const c = { ...DEFAULT_CALIB, ...calib }
  const dir = fs.mkdtempSync(path.join(tmpDir, 'scan-'))
  const STEP = 1000 / c.fps
  const durS = (endMs - startMs) / 1000
  execFileSync(ffmpeg, ['-y', '-ss', (startMs / 1000).toFixed(3), '-i', videoFile,
    '-t', (durS + 0.5).toFixed(3), '-vf', `scale=${c.scaleW}:${c.scaleH}`, '-r', String(c.fps),
    '-frames:v', String(Math.ceil(durS * c.fps) + c.fps), path.join(dir, 'g-%04d.png')], { stdio: 'pipe' })
  const isGray = (p, x, y) => {
    const o = (y * p.w + x) * p.bpp
    return Math.abs(p.data[o] - c.grayCenter) < c.grayTolerance
      && Math.abs(p.data[o + 1] - c.grayCenter) < c.grayTolerance
  }
  // 撕裂帧：右下四分位平均亮度（亮底内容帧该区域恒亮，撕裂帧纯黑 ≈0）
  const isTorn = (p) => {
    let sum = 0, n = 0
    for (let y = Math.floor(p.h * 0.75); y < p.h; y += 2)
      for (let x = Math.floor(p.w * 0.75); x < p.w; x += 2) {
        const o = (y * p.w + x) * p.bpp
        sum += (p.data[o] + p.data[o + 1] + p.data[o + 2]) / 3; n++
      }
    return sum / n < c.tornThreshold
  }
  const flagged = []
  for (const f of fs.readdirSync(dir).sort()) {
    const p = decodePng(path.join(dir, f))
    // 多个采样点同时为纯灰才判定灰带（避免误伤内容帧）
    flagged.push(c.grayPoints.every(([x, y]) => isGray(p, x, y)) || isTorn(p))
  }
  const spans = []
  for (let i = 0; i < flagged.length; i++) {
    if (!flagged[i]) continue
    let j = i
    while (j + 1 < flagged.length && flagged[j + 1]) j++
    const s = Math.max(startMs, Math.round(startMs + i * STEP - c.expandFrames * STEP))
    const e = Math.min(endMs, Math.round(startMs + (j + 1) * STEP + c.expandFrames * STEP))
    if (e - s >= c.minSpanMs) spans.push([s, e])
    i = j
  }
  fs.rmSync(dir, { recursive: true, force: true })
  return spans
}
