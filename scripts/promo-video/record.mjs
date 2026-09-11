#!/usr/bin/env node
/**
 * record.mjs — MarkFlow 宣传视频录制（真实扩展版）
 *
 * 用法：node scripts/promo-video/record.mjs [zh|en]（默认 zh）
 * 产出：assets/markflow-promo.webm / assets/markflow-promo.en.webm（1920×1080）
 *
 * 架构（spike.mjs 已验证）：
 *   - 页面即舞台：pages/{a,b,d}.html（布列松笔记）+ rec.css/rec.js（片头卡/虚拟光标/键帽/缩放/空镜）
 *   - 真实扩展打标：Alt 划词 → Tooltip 色点/保存按钮；Alt+S 快捷保存（合成按键走真实 handler，见下）
 *   - 侧栏为真实 sidepanel iframe（WAR patch 构建产物，不动 src）
 *   - 跨页回跳由扩展 tabs.create 切前台 tab → 每 tab 一轨 webm → 重编码裁剪 + 纯 JS remux 拼接
 *
 * 已知怪象（spike 分诊）：Tooltip 打开期间 Playwright 真实 Alt+S 偶发不触发扩展 handler
 * （事件已正确到达页面），合成 KeyboardEvent 走同一 handleKeydown 闭环且对镜头不可见，故采用。
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

/* 录屏组件（chromium/ffmpeg）装在项目内 node_modules，须在 require 前指定 */
process.env.PLAYWRIGHT_BROWSERS_PATH = '0'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const EXT_DIR = path.join(ROOT, 'extension')
const PAGES_DIR = path.join(__dirname, 'pages')
const LANG = process.argv[2] === 'en' ? 'en' : 'zh'
const OUT_FILE = path.join(ROOT, 'assets', LANG === 'en' ? 'markflow-promo.en.webm' : 'markflow-promo.webm')
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-promo-'))
const FFMPEG = (() => {
  const dir = path.join(ROOT, 'node_modules/playwright-core/.local-browsers')
  const d = fs.readdirSync(dir).find(d => d.startsWith('ffmpeg-'))
  if (!d) throw new Error('内置 ffmpeg 未安装：npx playwright install ffmpeg')
  return path.join(dir, d, 'ffmpeg-mac')
})()

const VW = 1920
const VH = 1080
const ZOOM_TEXT = 1.4
const ZOOM_SIDEBAR = 1.2

/* ——— screencast 灰带自动检测：goto-mark 点击后合成器偶发不再栅格化
     底部瓦片（纯灰 #808080），重锤治愈前的残留窗口在此帧级剪掉 ——— */
/** 极简 PNG 解码（8-bit RGB/RGBA，无隔行）：返回 { w, h, bpp, data } */
function decodePng(file) {
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

/** 扫描 videoFile 的 [startMs, endMs]，返回底部灰带时间窗 [[s,e],…]（毫秒）
   注意：Playwright 产出的 webm 时间戳不规律，-to 可能失效导致全片抽帧（实测 4 分钟
   视频抽出 1.9 万帧 4K PNG）。故：-t 限时长 + -frames:v 硬上限 + 缩到 480p 再解码。 */
function detectGraySpans(videoFile, startMs, endMs) {
  const dir = fs.mkdtempSync(path.join(TMP_DIR, 'scan-'))
  const FPS = 20, STEP = 1000 / FPS
  const durS = (endMs - startMs) / 1000
  execFileSync(FFMPEG, ['-y', '-ss', (startMs / 1000).toFixed(3), '-i', videoFile,
    '-t', (durS + 0.5).toFixed(3), '-vf', 'scale=480:270', '-r', String(FPS),
    '-frames:v', String(Math.ceil(durS * FPS) + FPS), path.join(dir, 'g-%04d.png')], { stdio: 'pipe' })
  const isGray = (p, x, y) => {
    const o = (y * p.w + x) * p.bpp
    return Math.abs(p.data[o] - 127) < 7 && Math.abs(p.data[o + 1] - 127) < 7
  }
  const flagged = []
  for (const f of fs.readdirSync(dir).sort()) {
    const p = decodePng(path.join(dir, f))
    // 三个采样点同时为纯灰才判定（避免误伤内容帧）；坐标已随 scale=480:270 折算
    flagged.push(isGray(p, 120, 260) && isGray(p, 240, 260) && isGray(p, 360, 260))
  }
  const spans = []
  for (let i = 0; i < flagged.length; i++) {
    if (!flagged[i]) continue
    let j = i
    while (j + 1 < flagged.length && flagged[j + 1]) j++
    const s = Math.max(startMs, Math.round(startMs + i * STEP - 3 * STEP)) // 前后各扩三帧（采样间隔内可能漏灰帧）
    const e = Math.min(endMs, Math.round(startMs + (j + 1) * STEP + 3 * STEP))
    if (e - s >= 80) spans.push([s, e])
    i = j
  }
  fs.rmSync(dir, { recursive: true, force: true })
  return spans
}

/* ——— WAR patch：允许 sidepanel 被 http 页面 iframe 嵌入（仅改 gitignored 构建产物） ——— */
function patchManifest() {
  const mp = path.join(EXT_DIR, 'manifest.json')
  const m = JSON.parse(fs.readFileSync(mp, 'utf-8'))
  if (!m.background?.service_worker)
    throw new Error('extension/ 是 Firefox 构建，请先 npm run build:chromium')
  const war = m.web_accessible_resources?.[0]
  if (!war) throw new Error('manifest 缺少 web_accessible_resources')
  if (!war.resources.includes('dist/sidepanel/index.html')) {
    war.resources.push('dist/sidepanel/index.html')
    fs.writeFileSync(mp, JSON.stringify(m, null, 2))
    console.log('[patch] web_accessible_resources += dist/sidepanel/index.html')
  }
}

/* ——— 静态服务器（pages/ 目录） ——— */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' }
function serve(req, res) {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const file = path.normalize(path.join(PAGES_DIR, url === '/' ? '/a.html' : url))
  if (!file.startsWith(PAGES_DIR) || !fs.existsSync(file)) { res.writeHead(404); return res.end('nf') }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
}

/* ——— 演示动线（核心链路：划词标记 / 快捷标记 / 换色 / 侧栏回跳） ———
   双语文案表：beats.phrase 必须与 pages/i18n.js 的英文段落逐字一致（indexOf 定位） */
const TEXT = {
  zh: {
    browserLang: 'zh-CN',
    sidebarTitle: '标记管理', // 侧栏 iframe 就位信号
    itemA: '人物内部心结', itemB: '节奏源于精确', itemD: '创造首先就是删减、剔除', // 侧栏标记项匹配子串
    beats: {
      markA: { para: 1, phrase: '只有人物内部心结的产生与和解才能给电影带来运动' }, // Tooltip → 保存按钮（默认黄）
      markB: { para: 3, phrase: '节奏源于精确', shortcut: true }, // Tooltip → Alt+S
      markD: { para: 0, phrase: '创造首先就是删减、剔除', swatch: 1 }, // Tooltip → 绿色点 → 保存
    },
    keys: { drag: '按住划词', quick: '快捷标记' },
    caps: {
      mark: '按住修饰键划词，唤起标记工具栏',
      quick: '划词之后，快捷键一键收藏',
      color: '换个颜色，给想法分个类',
      jump: '侧栏里点一下标记，跳回原文',
      cross: '跨页面也一样：点标记，跳转到原文',
      land: '自动定位到高亮，脉冲提示位置',
      again: '再跳一篇，回到原文',
    },
  },
  en: {
    browserLang: 'en-US',
    sidebarTitle: 'Marks',
    itemA: 'inner knot', itemB: 'Rhythm comes from precision', itemD: 'creation begins with cutting',
    beats: {
      markA: { para: 1, phrase: "Only the forming and resolving of a character's inner knot can bring movement to a film" },
      markB: { para: 3, phrase: 'Rhythm comes from precision', shortcut: true },
      markD: { para: 0, phrase: 'creation begins with cutting and stripping away', swatch: 1 },
    },
    keys: { drag: 'hold & select', quick: 'quick save' },
    caps: {
      mark: 'Hold the modifier and select to open the toolbar',
      quick: 'One shortcut saves the selection',
      color: 'Switch colors to sort your thoughts',
      jump: 'Click a mark in the sidebar — jump right back',
      cross: 'Works across pages too: click to jump to the source',
      land: 'Auto-located to the highlight, pulsed in place',
      again: 'Another page, back to the text again',
    },
  },
}
const T = TEXT[LANG]
const BEATS = T.beats

async function main() {
  patchManifest()
  const { renderVideo } = await import('./webm-concat.mjs')

  const server = http.createServer(serve)
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`

  let context
  try {
    await record()
  }
  finally {
    await context?.close().catch(() => {}) // 兜底：失败也关浏览器，避免子进程占住 stdout 管道
    server.close()
  }

  async function record() {
  context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'mf-prof-')), {
    channel: 'chromium', // 完整 Chromium（默认 headless shell 不支持扩展；branded Chrome 152 禁用 --load-extension）
    headless: true,
    args: [`--lang=${T.browserLang}`, `--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`],
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    recordVideo: { dir: TMP_DIR, size: { width: VW, height: VH } },
  })

  let [bg] = context.serviceWorkers()
  if (!bg) bg = await context.waitForEvent('serviceworker')
  bg.on('pageerror', e => console.error('[sw]', String(e).slice(0, 200)))
  const extId = bg.url().split('/')[2]
  console.log(`[ext] ${extId} · [stage] ${origin}/a.html?ext=…`)

  /* 英文版：--lang 影响不了 getUILanguage（跟随系统），走扩展自身设置覆盖。
     注意 useWebExtensionStorage 默认 mergeDefaults=false：一旦落盘就是全量读取，
     必须写入完整 settings（与 src/logic/settings.ts defaultSettings 同步维护）。 */
  if (LANG === 'en') {
    await bg.evaluate(async () => {
      const k = 'webext-settings'
      const cur = (await chrome.storage.local.get(k))[k]
      const stored = typeof cur === 'string' ? JSON.parse(cur) : (cur || {})
      const full = {
        defaultHighlightColor: '#FFFF00',
        highlightColors: ['#FFFF00', '#99FF99', '#FF9999', '#99CCFF', '#FFCC99'],
        blacklist: [],
        shortcutSave: 'Alt+S',
        shortcutDelete: 'Alt+D',
        autoAssociation: true,
        highlightHeight: 5,
        lastUsedTags: [],
        theme: 'auto',
        ...stored,
        language: 'en',
      }
      await chrome.storage.local.set({ [k]: JSON.stringify(full) })
    })
    console.log('[lang] settings.language=en 已注入')
  }

  const t0 = Date.now()
  const page = await context.newPage()
  page.on('pageerror', e => console.error('[pageerror]', e.message))

  /* ——— 基础助手 ——— */
  const hold = ms => page.waitForTimeout(ms)
  let shotN = 0
  const shot = async (pg, name) => pg.screenshot({ path: path.join(TMP_DIR, `shot-${String(++shotN).padStart(2, '0')}-${name}.png`) })

  let cursor = { x: VW / 2, y: VH / 2 + 80 }
  async function glide(pg, to, { steps = 22, delay = 14 } = {}) {
    const from = { ...cursor }
    for (let i = 1; i <= steps; i++) {
      const x = from.x + (to.x - from.x) * (i / steps)
      const y = from.y + (to.y - from.y) * (i / steps)
      await pg.mouse.move(x, y)
      await pg.evaluate(([x, y]) => window.rec.setCursor(x, y), [x, y])
      await pg.waitForTimeout(delay)
    }
    cursor = { ...to }
  }
  async function clickScreen(pg, pt, { steps = 18 } = {}) {
    await glide(pg, pt, { steps })
    await pg.waitForTimeout(160)
    await pg.evaluate(() => window.rec.press(true))
    await pg.mouse.down()
    await pg.waitForTimeout(90)
    await pg.mouse.up()
    // 点击可能触发导航（翻篇），收尾动画的执行上下文可能已销毁——容错跳过
    await pg.evaluate(([x, y]) => { window.rec.press(false); window.rec.ripple(x, y) }, [pt.x, pt.y]).catch(() => {})
    await pg.waitForTimeout(150)
  }
  const keys = (pg, list, label) => pg.evaluate(([l, lb]) => window.rec.showKeys(l, lb), [list, label || ''])
  const cap = (pg, text, pos) => pg.evaluate(([t, p]) => window.rec.caption(t, p), [text || null, pos || 'bottom'])
  const focus = (pg, x, y, s) => pg.evaluate(([x, y, s]) => window.rec.focus(x, y, s), [x, y, s])
  const fit = (pg, instant) => pg.evaluate(i => window.rec.fit(i), !!instant)
  const toScreen = (pg, p) => pg.evaluate(p => window.rec.toScreen(p), p)

  /* 重锤：viewport 抖动 1px 强制 surface 重建，治愈 goto-mark 点击引发的
     screencast 底部灰带（#808080 未栅格化瓦片，不自愈；CDP 截图走自身捕获
     路径，治不了 screencast 管线——实测无效）。
     ⚠️ 副作用：resize 会让合成器在随后 ~2s 内偶发吐出表面尺寸错乱帧
     （内容缩左上角+黑边）/ 使紧随的大 transform 过渡混瓦片撕裂。
     因此：落锤后本 tab 不允许再有任何 zoom 过渡（⑤ 已改为全景直接点击），
     且落锤与下一次点击之间留足 settle。 */
  async function hammer(pg, delays = [200, 400, 400, 400]) {
    for (const d of delays) {
      await pg.waitForTimeout(d)
      await pg.setViewportSize({ width: VW, height: VH - 1 })
      await pg.waitForTimeout(120)
      await pg.setViewportSize({ width: VW, height: VH })
    }
  }

  /* ——— 划词（测量返回基准坐标：getClientRects 是缩放后的视觉坐标，统一经 toBase 换算） ——— */
  async function measurePhrase(pg, paraIdx, phrase) {
    return pg.evaluate(({ paraIdx, phrase }) => {
      const p = document.querySelector(`[data-para="${paraIdx}"]`)
      if (!p) return null
      const i = p.textContent.indexOf(phrase)
      if (i < 0) return null
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
      let acc = 0, sn, en, so, eo, n
      while ((n = walker.nextNode())) {
        const len = n.textContent.length
        if (!sn && acc + len > i) { sn = n; so = i - acc }
        if (!en && acc + len >= i + phrase.length) { en = n; eo = i + phrase.length - acc }
        acc += len
      }
      const r = document.createRange()
      r.setStart(sn, so); r.setEnd(en, eo)
      const s = window.rec.scale()
      const rects = [...r.getClientRects()].map((q) => {
        const o = window.rec.toBase({ x: q.x, y: q.y })
        return { x: o.x, y: o.y, w: q.width / s, h: q.height / s }
      })
      if (!rects.length) return null
      const f = rects[0], l = rects[rects.length - 1]
      return {
        start: { x: f.x + Math.min(2, f.w / 4), y: f.y + f.h / 2 },
        end: { x: l.x + l.w - Math.min(2, l.w / 4), y: l.y + l.h / 2 },
        rects,
      }
    }, { paraIdx, phrase })
  }

  function dragWaypoints(m) {
    const wps = [m.start]
    m.rects.forEach((r, i) => {
      const right = { x: r.x + r.w - 2, y: r.y + r.h / 2 }
      if (i === 0) { if (m.rects.length > 1) wps.push(right) }
      else {
        wps.push({ x: r.x + 2, y: r.y + r.h / 2 })
        if (i < m.rects.length - 1) wps.push(right)
      }
    })
    wps.push(m.end)
    return wps.filter((p, i) => i === 0 || Math.hypot(p.x - wps[i - 1].x, p.y - wps[i - 1].y) > 3)
  }

  async function selectPhrase(pg, beat) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const m = await measurePhrase(pg, beat.para, beat.phrase)
      if (!m) throw new Error(`phrase not found: ${beat.phrase}`)
      m.start.x += attempt * 1.5
      const wps = []
      for (const p of dragWaypoints(m)) wps.push(await toScreen(pg, p))
      await pg.keyboard.down('Alt')
      await glide(pg, wps[0], { steps: 20, delay: 14 })
      await pg.waitForTimeout(160)
      await pg.evaluate(() => window.rec.press(true))
      await pg.mouse.down()
      for (let i = 1; i < wps.length; i++) await glide(pg, wps[i], { steps: 12, delay: 24 })
      await pg.waitForTimeout(200)
      await pg.mouse.up()
      await pg.evaluate(() => window.rec.press(false))
      await pg.keyboard.up('Alt')
      // 注意：扩展预览会包 span 并破坏原生选区，不能用 getSelection 验证；
      // 以 Tooltip 出现 + 预览 span 文本为准（合成 Escape 清场，同 Alt+S 的已知按键问题）
      try {
        await pg.waitForSelector('.tooltip-card', { timeout: 2500 })
        const preview = await pg.locator('span.webext-highlight-preview').textContent().catch(() => '')
        if (preview.trim() === beat.phrase) return m
        console.log(`[retry] preview mismatch (${attempt + 1}): "${preview.slice(0, 40)}"`)
      }
      catch {
        console.log(`[retry] tooltip 未出现 (${attempt + 1})`)
      }
      await pg.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
      await pg.waitForTimeout(300)
    }
    throw new Error(`selection failed: ${beat.phrase}`)
  }

  const waitTooltip = pg => pg.waitForSelector('.tooltip-card', { timeout: 6000 }) // locator 穿透 open shadow
  const saveBtnBox = pg => pg.locator('.tooltip-actions button.bg-amber-500').boundingBox() // 琥珀主按钮=确认高亮
  const swatchBox = (pg, i) => pg.locator('.color-swatch').nth(i).boundingBox()
  const center = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })

  /** Alt+S：合成事件走真实 handler（见文件头注） */
  async function pressAltS(pg) {
    await pg.evaluate(() => { window.focus(); if (document.activeElement !== document.body) document.activeElement.blur() })
    await pg.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', altKey: true, bubbles: true, cancelable: true })))
  }

  /** 侧栏标记项：iframe 内局部坐标 → 视口屏幕坐标（iframe 在缩放层内，内容随层缩放） */
  async function sidebarItemCenter(pg, phrase) {
    const frame = pg.frames().find(f => f.url().includes('/dist/sidepanel/index.html'))
    if (!frame) throw new Error('侧栏 iframe 不在')
    const local = await frame.evaluate((ph) => {
      const els = [...document.querySelectorAll('li .cursor-pointer')]
      const el = els.find(e => e.textContent.includes(ph))
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }, phrase)
    if (!local) throw new Error(`侧栏未找到标记: ${phrase}`)
    return pg.evaluate((l) => {
      const r = document.getElementById('sp').getBoundingClientRect()
      const s = window.rec.scale()
      const screen = { x: r.x + l.x * s, y: r.y + l.y * s }
      return { ...screen, base: window.rec.toBase(screen) }
    }, local)
  }

  async function waitMarkCount(pg, n) {
    await pg.waitForFunction(
      c => document.querySelectorAll('span[class*="webext-highlight-"]:not(.webext-highlight-preview)').length >= c,
      n, { timeout: 6000 },
    )
  }

  const waitSidebarHas = (pg, ph) => pg.frames().find(f => f.url().includes('/dist/sidepanel/index.html'))
    .waitForFunction(p => document.body.textContent.includes(p), ph, { timeout: 8000 })

  /** 等落地页恢复+脉冲信标，返回 { restored, pulse }（performance.now 毫秒） */
  async function waitBeacons(pg) {
    await pg.waitForFunction(() => window.__recTimeline?.some(e => e.ev === 'pulse'), null, { timeout: 15000 })
    const tl = await pg.evaluate(() => window.__recTimeline)
    return {
      restored: tl.find(e => e.ev === 'restored')?.t ?? 600,
      pulse: tl.find(e => e.ev === 'pulse')?.t ?? 1200,
    }
  }

  /* ═══ T0：A 标记 → B 快捷标记 → D 换色标记 → 同页回跳 → 跨页点击 ═══ */
  await page.goto(`${origin}/a.html?ext=${extId}&lang=${LANG}`)
  await page.waitForSelector('#web-marker-extension', { state: 'attached', timeout: 10000 }) // content script 就位
  await waitSidebarHas(page, T.sidebarTitle) // 侧栏 iframe 就位
  await hold(1600) // 片头词标停留
  await page.evaluate(() => window.rec.introOut())
  await hold(900)

  // ① A：Tooltip + 保存按钮
  const mA = await measurePhrase(page, BEATS.markA.para, BEATS.markA.phrase)
  const cA = { x: (mA.start.x + mA.end.x) / 2, y: (mA.start.y + mA.end.y) / 2 }
  await focus(page, cA.x, cA.y, ZOOM_TEXT)
  await hold(800)
  await keys(page, ['⌥ / Alt'], T.keys.drag)
  await cap(page, T.caps.mark)
  await selectPhrase(page, BEATS.markA)
  await waitTooltip(page)
  await hold(800) // Tooltip 可读：五色点 + 备注 + 保存
  await clickScreen(page, center(await saveBtnBox(page)), { steps: 14 })
  await keys(page, null)
  await cap(page, null)
  await waitMarkCount(page, 1)
  await hold(900) // 落色 + 侧栏出现第一条
  await shot(page, 'mark-a')

  // ② 翻篇 → B：Alt+S 快捷标记
  await fit(page)
  await hold(700)
  await clickScreen(page, center(await page.locator('.pager a[href*="b.html"]').boundingBox()))
  await page.waitForFunction(() => document.body.dataset.page === 'b', null, { timeout: 8000 })
  await waitSidebarHas(page, T.itemA) // 侧栏带来上一篇的标记
  await hold(600)
  const mB = await measurePhrase(page, BEATS.markB.para, BEATS.markB.phrase)
  await focus(page, mB.start.x + 120, mB.start.y, ZOOM_TEXT)
  await hold(800)
  await keys(page, ['⌥ / Alt'], T.keys.drag)
  await selectPhrase(page, BEATS.markB)
  await waitTooltip(page)
  await hold(450)
  await keys(page, ['⌥ / Alt', 'S'], T.keys.quick)
  await cap(page, T.caps.quick, 'top') // Tooltip 占住底部，字幕挪到顶部
  await hold(600)
  await pressAltS(page)
  await hold(250)
  await keys(page, null)
  await waitMarkCount(page, 1) // B 页第一条（存储里已有 A 的）
  await hold(1400) // 落色可读，字幕全程保留（总可见 ~2.4s）
  await cap(page, null)
  await hold(300)
  await shot(page, 'mark-b')

  // ③ 翻篇 → D：换色（绿）+ 保存
  await fit(page)
  await hold(700)
  await clickScreen(page, center(await page.locator('.pager a[href*="d.html"]').boundingBox()))
  await page.waitForFunction(() => document.body.dataset.page === 'd', null, { timeout: 8000 })
  await hold(600)
  const mD = await measurePhrase(page, BEATS.markD.para, BEATS.markD.phrase)
  const cD = { x: (mD.start.x + mD.end.x) / 2, y: (mD.start.y + mD.end.y) / 2 }
  await focus(page, cD.x, cD.y, ZOOM_TEXT)
  await hold(800)
  await keys(page, ['⌥ / Alt'], T.keys.drag)
  await selectPhrase(page, BEATS.markD)
  await waitTooltip(page)
  await hold(600)
  await cap(page, T.caps.color)
  await clickScreen(page, center(await swatchBox(page, BEATS.markD.swatch)), { steps: 12 })
  await hold(350) // 绿点选中环可读
  await clickScreen(page, center(await saveBtnBox(page)), { steps: 12 })
  await keys(page, null)
  await cap(page, null)
  await waitMarkCount(page, 1)
  await hold(900)
  await shot(page, 'mark-d')

  // ④ 同页回跳：侧栏点 D 自己的标记 → 原 tab 滚动脉冲
  await fit(page)
  await hold(700)
  let sb = await sidebarItemCenter(page, T.itemD)
  await focus(page, sb.base.x, sb.base.y, ZOOM_SIDEBAR)
  await hold(800)
  await cap(page, T.caps.jump)
  await clickScreen(page, await sidebarItemCenter(page, T.itemD), { steps: 14 })
  await hold(200)
  await fit(page) // 回全景看脉冲
  await hammer(page) // 治愈 goto-mark 点击引发的 screencast 底部灰带
  await hold(500) // 脉冲余韵
  await cap(page, null)
  await shot(page, 'jump-same-page')

  // ⑤ 跨页回跳：全景下光标直接滑向侧栏点 A 的标记 → 扩展 tabs.create 开新前台 tab（T1 接管）
  // （落锤后本 tab 禁做 zoom 过渡——resize 的迟到表面错乱帧会混进过渡；全景点击已足够清晰）
  await cap(page, T.caps.cross)
  await hold(1200) // 字幕可读 + 落锤后的 settle（让迟到的 resize 错乱帧落在静态画面上之前的窗口外）
  const sb5 = await sidebarItemCenter(page, T.itemA)
  const p1Promise = context.waitForEvent('page')
  const tClickA = Date.now()
  await clickScreen(page, sb5, { steps: 14 })
  const page1 = await p1Promise
  const t1Create = Date.now()
  console.log('[timing] cross-page click→new-tab:', t1Create - tClickA, 'ms')
  page1.on('pageerror', e => console.error('[T1]', e.message))
  await hold(400)
  const v0 = page.video()

  /* ═══ T1：落地页 A（自动恢复+脉冲）→ 侧栏点 B 的标记 ═══ */
  const bc1 = await waitBeacons(page1)
  await cap(page1, T.caps.land)
  await hold(1000) // 脉冲余韵（脉冲动画本身 1s）
  await shot(page1, 'jump-land-a')
  let sb1 = await sidebarItemCenter(page1, T.itemB)
  await cap(page1, null)
  await focus(page1, sb1.base.x, sb1.base.y, ZOOM_SIDEBAR)
  await hold(800)
  const p2Promise = context.waitForEvent('page')
  const tClickB = Date.now()
  await clickScreen(page1, await sidebarItemCenter(page1, T.itemB), { steps: 14 })
  const page2 = await p2Promise
  const t2Create = Date.now()
  page2.on('pageerror', e => console.error('[T2]', e.message))
  await hold(400)
  const v1 = page1.video()

  /* ═══ T2：落地页 B（自动恢复+脉冲）→ 空镜收尾 ═══ */
  const bc2 = await waitBeacons(page2)
  await cap(page2, T.caps.again)
  await hold(1200)
  await shot(page2, 'jump-land-b')
  const tOutro = Date.now()
  await cap(page2, null)
  await page2.evaluate(() => window.rec.outro('MarkFlow'))
  await hold(2300) // 窗口淡出 0.8s + 收束卡停留
  const v2 = page2.video()

  /* ——— 出片：帧级裁剪 + remux 拼接 ——— */
  await context.close()
  context = null
  const [f0, f1, f2] = await Promise.all([v0.path(), v1.path(), v2.path()])

  const seg = (file, startMs, endMs) => ({ file, startMs: Math.max(0, Math.round(startMs)), endMs: Math.round(endMs) })
  // T0：裁掉首帧加载白屏、止于跨页点击后；并自动切除 screencast 灰带残留窗口
  const t0Start = 300, t0End = tClickA - t0 + 350
  const graySpans = detectGraySpans(f0, t0Start, t0End)
  if (graySpans.length) console.log('[gray-cut]', JSON.stringify(graySpans))
  const t0Segs = []
  let cutAt = t0Start
  for (const [s, e] of graySpans) {
    if (s - cutAt >= 120) t0Segs.push(seg(f0, cutAt, s))
    cutAt = Math.max(cutAt, e)
  }
  if (t0End - cutAt >= 120) t0Segs.push(seg(f0, cutAt, t0End))
  const segments = [
    ...t0Segs,
    seg(f1, bc1.restored - 500, tClickB - t1Create + 350), // 从恢复前片刻起：落色→滚动→脉冲全收
    seg(f2, bc2.restored - 500, tOutro - t2Create + 2300), // 落地脉冲 → 空镜收束卡
  ]
  console.log('[cut]', JSON.stringify(segments.map(s => [s.startMs, s.endMs])))
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  const r = renderVideo(FFMPEG, segments, OUT_FILE, TMP_DIR)
  const mb = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1)
  console.log(`[done] ${OUT_FILE} (${(r.durationMs / 1000).toFixed(1)}s, ${r.totalFrames} 帧, ${mb} MB)`)
  console.log(`[shots] ${TMP_DIR}`)
  }
}

main().catch((e) => {
  console.error('[fail]', e)
  console.log(`[shots] ${TMP_DIR}`)
  process.exit(1)
})
