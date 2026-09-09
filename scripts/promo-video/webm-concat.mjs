/**
 * WebM 多轨拼接（Playwright 内置裁剪版 ffmpeg + 纯 JS remux）
 *
 * 约束：内置 ffmpeg 只有 matroska demuxer / webm muxer / png encoder / image2pipe，
 * 无 concat demuxer/filter、无 png parser（image2pipe 无法切分 PNG 流）、无 mjpeg encoder；
 * 且 screencast VP8 关键帧极稀疏（约 5s 一个），remux 裁剪无法帧级精确。
 *
 * 方案（两段式）：
 *   1) 逐段重编码裁剪：ffmpeg -ss/-t 解码侧精确到帧 → libvpx 重编码出独立 seg.webm
 *     （重编码天然以关键帧开头，保证拼接处解码连续性）
 *   2) 纯 JS remux 拼接：ts-ebml 解包 VP8 帧 → webm-muxer 重排连续时间戳装盒（不再转码）
 */
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { Decoder, tools } from 'ts-ebml'
import { ArrayBufferTarget, Muxer } from 'webm-muxer'

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

/** 解复用：{ codec, width, height, frames:[{ data:Buffer, key:boolean, time:number(ms) }] } */
export function demuxWebm(file) {
  const elms = new Decoder().decode(toArrayBuffer(fs.readFileSync(file)))
  let codec = 'V_VP8'
  let width = 0
  let height = 0
  let inCluster = false
  let clusterTime = 0
  const frames = []
  for (const e of elms) {
    if (e.name === 'CodecID' && e.type === 's')
      codec = e.value
    else if (e.name === 'PixelWidth' && e.type === 'u')
      width = e.value
    else if (e.name === 'PixelHeight' && e.type === 'u')
      height = e.value
    else if (e.name === 'Cluster' && e.type === 'm') {
      inCluster = !e.isEnd
      if (!e.isEnd)
        clusterTime = 0
    }
    else if (inCluster && e.name === 'Timestamp' && e.type === 'u') {
      clusterTime = e.value
    }
    else if (e.name === 'SimpleBlock' && e.type === 'b') {
      const b = tools.ebmlBlock(e.value) // { frames, keyframe, timecode(cluster 相对), trackNumber }
      for (const frame of b.frames)
        frames.push({ data: frame, key: b.keyframe, time: clusterTime + b.timecode })
    }
  }
  return { codec, width, height, frames }
}

function run(args, label) {
  const r = spawnSync(args[0], args.slice(1), { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0)
    throw new Error(`${label} 失败 exit=${r.status}\n${(r.stderr || '').slice(-500)}`)
  return r
}

/** 步骤 1：单段重编码裁剪（帧级精确，输出以关键帧起始） */
export function encodeSegment(ffmpeg, file, startMs, endMs, outFile) {
  const args = [ffmpeg, '-ss', (startMs / 1000).toFixed(3)]
  if (Number.isFinite(endMs))
    args.push('-t', ((endMs - startMs) / 1000).toFixed(3))
  args.push('-i', file, '-c:v', 'libvpx', '-crf', '12', '-b:v', '2M', '-an', '-y', outFile)
  run(args, `encodeSegment(${startMs}~${endMs})`)
  return outFile
}

/** 步骤 2：纯 JS remux 拼接（不重转码；各段首帧须为关键帧） */
export function remuxConcat(files, outFile) {
  const tracks = files.map(demuxWebm)
  const { codec, width, height } = tracks[0]
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec, width, height } })
  let offsetMs = 0
  let totalFrames = 0
  for (const { frames } of tracks) {
    if (!frames.length || !frames[0].key)
      throw new Error('remuxConcat: 段首帧非关键帧（encodeSegment 产物应天然满足）')
    const base = frames[0].time
    const deltas = frames.slice(1).map((f, j) => f.time - frames[j].time).filter(d => d > 0).sort((a, b) => a - b)
    const nominal = deltas.length ? deltas[Math.floor(deltas.length / 2)] : 40
    for (const f of frames)
      muxer.addVideoChunkRaw(f.data, f.key ? 'key' : 'delta', Math.round((offsetMs + f.time - base) * 1000))
    offsetMs += frames[frames.length - 1].time - base + nominal
    totalFrames += frames.length
  }
  muxer.finalize()
  fs.writeFileSync(outFile, Buffer.from(muxer.target.buffer))
  return { durationMs: Math.round(offsetMs), totalFrames }
}

/** 一条龙：segments = [{ file, startMs, endMs }] → outFile；返回 { durationMs, totalFrames } */
export function renderVideo(ffmpeg, segments, outFile, workDir) {
  const segs = segments.map((s, i) => {
    const f = `${workDir}/seg-${i}.webm`
    return encodeSegment(ffmpeg, s.file, s.startMs ?? 0, s.endMs ?? Infinity, f)
  })
  return remuxConcat(segs, outFile)
}
