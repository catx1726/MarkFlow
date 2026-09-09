#!/usr/bin/env node
/**
 * spike.mjs — 真实插件录制方案的可行性验证（一次性脚本，通过后即可废弃）
 *
 * 验证项：
 *   S1 sidepanel 以 iframe 嵌入文章页（WAR patch 后），Vue/存储/消息正常
 *   S2 Alt 划词 → 真实 Tooltip → locator 穿透 open shadow 点色点/保存
 *   S3 Alt+S 快捷保存闭环 + 侧栏 iframe 自动刷新出新标记
 *   S5 多 tab 多轨 webm → 内置 ffmpeg concat 成单条
 */
import { createRequire } from 'node:module'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

process.env.PLAYWRIGHT_BROWSERS_PATH = '0'
const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const EXT_DIR = path.join(ROOT, 'extension')
const FFMPEG = path.join(ROOT, 'node_modules/playwright-core/.local-browsers/ffmpeg-1011/ffmpeg-mac')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-spike-'))

let PASS = 0
let FAIL = 0
function report(ok, name, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  ok ? PASS++ : FAIL++
}

/* ——— WAR patch：允许 sidepanel 被 http 页面 iframe 嵌入（仅改构建产物） ——— */
function patchManifest() {
  const mp = path.join(EXT_DIR, 'manifest.json')
  const m = JSON.parse(fs.readFileSync(mp, 'utf-8'))
  const war = m.web_accessible_resources?.[0]
  if (!war)
    throw new Error('manifest 缺少 web_accessible_resources')
  if (!war.resources.includes('dist/sidepanel/index.html')) {
    war.resources.push('dist/sidepanel/index.html')
    fs.writeFileSync(mp, JSON.stringify(m, null, 2))
    console.log('[patch] web_accessible_resources += dist/sidepanel/index.html')
  }
  else {
    console.log('[patch] 已存在，跳过')
  }
}

/* ——— spike 文章页（两段布列松笔记文本） ——— */
const P_A = '只有人物内部心结的产生与和解才能给电影带来运动，真正的运动。我努力呈现的正是这种运动。'
const P_B = '节奏源于精确：一个东西是这样，一个东西不是；一个东西在属于它的位子上，一个东西不在。'

function spikeHtml(title, paras) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:ui-sans-serif,system-ui;max-width:640px;margin:80px auto;padding:0 24px;line-height:2;color:#44403c}h1{color:#1c1917}
#sp{position:fixed;right:0;top:0;width:340px;height:100vh;border:0;border-left:1px solid rgba(0,0,0,.15)}</style>
</head><body>
<h1>${title}</h1>
${paras.map(p => `<p>${p}</p>`).join('\n')}
<iframe id="sp"></iframe>
<script>
  const ext = new URLSearchParams(location.search).get('ext')
  if (ext) document.getElementById('sp').src = \`chrome-extension://\${ext}/dist/sidepanel/index.html\`
</script>
</body></html>`
}

async function main() {
  patchManifest()

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x').pathname
    const html = u === '/b' ? spikeHtml('笔记 B', [P_B]) : spikeHtml('笔记 A', [P_A, P_B])
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`

  const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'mf-prof-')), {
    channel: 'chromium', // 完整 Chromium 构建（默认无头是 headless shell，不支持扩展；branded Chrome 152 禁用 --load-extension）
    headless: true,
    args: [
      '--lang=zh-CN',
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
    ],
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    recordVideo: { dir: TMP, size: { width: 1440, height: 900 } },
  })

  const page = await context.newPage()
  page.on('pageerror', e => console.error('[pageerror]', e.message))
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text().slice(0, 200)) })

  // 扩展 ID（MV3 service worker）
  let [bg] = context.serviceWorkers()
  if (!bg) bg = await context.waitForEvent('serviceworker')
  bg.on('console', m => console.log('[sw console]', m.type(), m.text().slice(0, 300)))
  bg.on('pageerror', e => console.log('[sw pageerror]', String(e).slice(0, 300)))
  const extId = bg.url().split('/')[2]
  console.log(`[ext] ${extId}`)

  await page.goto(`${origin}/a?ext=${extId}`)
  await page.waitForTimeout(1500) // content script 注入 + 侧栏加载

  /* ——— S1：侧栏 iframe 嵌入 ——— */
  const spFrame = page.frames().find(f => f.url().includes('/dist/sidepanel/index.html'))
  if (!spFrame) {
    report(false, 'S1 侧栏 iframe 出现')
  }
  else {
    try {
      await spFrame.waitForFunction(
        () => document.querySelector('#app')?.children.length > 0 && document.body.textContent.trim().length > 0,
        null,
        { timeout: 8000 },
      )
      const text = await spFrame.evaluate(() => document.body.textContent.slice(0, 60))
      report(true, 'S1 侧栏 iframe 渲染', text.trim().replace(/\s+/g, ' '))
    }
    catch (e) {
      report(false, 'S1 侧栏 iframe 渲染', String(e).slice(0, 120))
    }
  }

  /* ——— S2：Alt 划词 → Tooltip → 色点+保存 ——— */
  async function selectPhrase(phrase) {
    const m = await page.evaluate((ph) => {
      const p = [...document.querySelectorAll('p')].find(x => x.textContent.includes(ph))
      if (!p) return null
      const i = p.textContent.indexOf(ph)
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
      let acc = 0, sn, en, so, eo, n
      while ((n = walker.nextNode())) {
        const len = n.textContent.length
        if (!sn && acc + len > i) { sn = n; so = i - acc }
        if (!en && acc + len >= i + ph.length) { en = n; eo = i + ph.length - acc }
        acc += len
      }
      const r = document.createRange()
      r.setStart(sn, so); r.setEnd(en, eo)
      const q = r.getBoundingClientRect()
      return { x: q.x, y: q.y, w: q.width, h: q.height }
    }, phrase)
    if (!m) throw new Error(`phrase not found: ${phrase}`)
    await page.keyboard.down('Alt')
    await page.mouse.move(m.x + 2, m.y + m.h / 2)
    await page.mouse.down()
    await page.mouse.move(m.x + m.w - 2, m.y + m.h / 2, { steps: 12 })
    await page.mouse.up()
    await page.keyboard.up('Alt')
  }

  try {
    await selectPhrase('人物内部心结的产生与和解')
    await page.waitForSelector('.tooltip-card', { timeout: 5000 }) // css 引擎穿透 open shadow
    report(true, 'S2a Tooltip 出现（locator 穿透 shadow）')
    const swatches = page.locator('.color-swatch')
    const n = await swatches.count()
    await swatches.nth(1).click({ timeout: 3000 }) // 绿
    const saveBtn = page.locator('.tooltip-actions button.bg-amber-500') // 琥珀主按钮=确认高亮（语言无关；tag 创建钮在 .tag-section 排除之）
    await saveBtn.click({ timeout: 3000 })
    await page.waitForSelector('span[class*="webext-highlight-"]', { timeout: 5000 })
    report(true, 'S2b 色点选择 + 保存按钮 → 标记落成', `色点数=${n}`)
  }
  catch (e) {
    report(false, 'S2 Tooltip/保存', String(e).slice(0, 200))
  }

  /* ——— S3：Alt+S 快捷保存 + 侧栏刷新 ——— */
  try {
    await selectPhrase('节奏源于精确')
    await page.waitForSelector('.tooltip-card', { timeout: 5000 })
    // 按键路由保险：iframe 侧栏可能抢焦点，Playwright 键盘事件只去焦点所在 frame
    await page.evaluate(() => { window.focus(); if (document.activeElement !== document.body) document.activeElement.blur() })
    await page.keyboard.press('Alt+KeyS')
    await page.waitForTimeout(1200)
    // 只数真实标记（排除预览 span.webext-highlight-preview）
    let marks = await page.locator('span[class*="webext-highlight-"]:not(.webext-highlight-preview)').count()
    let via = '真实按键'
    if (marks < 2) {
      // 已知怪象：tooltip 打开期间真实 Alt+S 偶发不触发 handler（页面已正确收到事件），
      // 页面内合成事件走同一 handleKeydown 闭环，对视频不可见，作为录制期退路
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', altKey: true, bubbles: true, cancelable: true })))
      await page.waitForTimeout(1000)
      marks = await page.locator('span[class*="webext-highlight-"]:not(.webext-highlight-preview)').count()
      via = '合成事件兜底'
    }
    report(marks >= 2, 'S3a Alt+S 快捷保存', `页面真实标记 span 组数=${marks}（${via}）`)
    if (spFrame) {
      try {
        await spFrame.waitForFunction(
          () => document.body.textContent.includes('节奏源于精确'),
          null,
          { timeout: 8000 },
        )
        report(true, 'S3b 侧栏 iframe 自动刷新出新标记')
      }
      catch {
        const dump = await spFrame.evaluate(() => document.body.textContent.replace(/\s+/g, ' ').slice(0, 200))
        // 诊断：iframe 内直读 chrome.storage，区分「保存没落盘」vs「广播/onChanged 没到 iframe」
        const stored = await spFrame.evaluate(async () => {
          const all = await chrome.storage.local.get(null)
          const marks = JSON.parse(all['marks-by-url-storage'] || '{}')
          const counts = Object.entries(marks).map(([k, v]) => `${new URL(k).pathname}:${v.length}`).join(',')
          return `marks=${counts || '无'} | keys=${Object.keys(all).join(',')}`
        })
        report(false, 'S3b 侧栏 iframe 自动刷新', `侧栏内容: ${dump} || ${stored}`)
      }
    }
  }
  catch (e) {
    report(false, 'S3 Alt+S/侧栏刷新', String(e).slice(0, 200))
  }

  /* ——— S5：多轨 concat（纯 JS remux：内置 ffmpeg 无 concat 能力） ——— */
  if (process.env.SKIP_S5) {
    console.log('[skip] S5（SKIP_S5=1）')
  }
  else try {
    const page2 = await context.newPage()
    await page2.goto(`${origin}/b?ext=${extId}`)
    await page2.waitForTimeout(2000)
    await page.bringToFront()
    await page.waitForTimeout(2000)

    const v1 = page.video()
    const v2 = page2.video()
    await context.close()

    const p1 = await v1.path()
    const p2 = await v2.path()
    const joined = path.join(TMP, 'joined.webm')
    const { renderVideo } = await import('./webm-concat.mjs')
    // 故意取非关键帧时刻（关键帧约 5s 一个）：验证重编码裁剪的帧级精度
    const r = renderVideo(FFMPEG, [
      { file: p1, startMs: 1300, endMs: 3300 },
      { file: p2, startMs: 700, endMs: 2700 },
    ], joined, TMP)
    const secs = r.durationMs / 1000
    report(Math.abs(secs - 4) < 0.6, 'S5 双轨 concat', `合成时长=${secs}s（期望≈4s）frames=${r.totalFrames}`)
  }
  catch (e) {
    report(false, 'S5 多轨 concat', String(e.message || e).slice(0, 700))
  }

  server.close()
  console.log(`\n[spike] ${PASS} pass / ${FAIL} fail · 临时目录 ${TMP}`)
  process.exit(FAIL ? 1 : 0)
}

main().catch((e) => {
  console.error('[spike fatal]', e)
  console.log(`[spike] 临时目录 ${TMP}`)
  process.exit(1)
})
