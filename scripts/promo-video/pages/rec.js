/**
 * rec.js — 录制页覆盖层与缩放引擎（window.rec API）
 *
 * 职责：片头卡、虚拟光标、键帽提示、#rec-wrap 缩放（fit/focus/toScreen/toBase）、
 * 空镜收尾、tooltip 视觉缩放同步（--rec-ui 穿透 shadow）、录制时轴信标（__recTimeline）。
 * 覆盖层全部挂在 body 直属（不经 #rec-wrap 变换）；文章+侧栏在 #rec-wrap 内被缩放。
 */
(() => {
  const wrap = document.getElementById('rec-wrap')

  /* 录制舞台版式已预先适配窗口，标记天然在可视区内；
     #rec-wrap 的 transform 缩放会扰乱 scrollIntoView 的坐标换算，
     导致根滚动条位移、露出画布外底色 —— 故在此禁掉滚动定位（脉冲闪烁不受影响）。 */
  Element.prototype.scrollIntoView = function () {}

  /* ——— 缩放模型：transform = translate(tx,ty) scale(s)，origin 0 0 ——— */
  const view = { s: 1, tx: 0, ty: 0 }
  const VW = 1920
  const VH = 1080

  function apply() {
    wrap.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`
    syncUiScale()
  }
  function fit(instant) {
    view.s = 1; view.tx = 0; view.ty = 0
    if (instant) {
      wrap.classList.add('instant')
      apply()
      wrap.getBoundingClientRect() // 强制 reflow，确保 instant 生效
      wrap.classList.remove('instant')
    }
    else apply()
  }
  /** 把基准坐标 (x,y) 缩放到视口中心偏上（文字段落的舒适阅读位） */
  function focus(x, y, s) {
    view.s = s
    view.tx = VW / 2 - x * s
    view.ty = VH / 2 - 40 - y * s
    apply()
  }
  const toScreen = p => ({ x: view.tx + p.x * view.s, y: view.ty + p.y * view.s })
  const toBase = p => ({ x: (p.x - view.tx) / view.s, y: (p.y - view.ty) / view.s })

  /* ——— tooltip 视觉缩放：CSS 变量穿透 open shadow（注入一次） ——— */
  let uiScaleInjected = false
  function syncUiScale() {
    const host = document.getElementById('web-marker-extension')
    if (host?.shadowRoot) {
      if (!uiScaleInjected) {
        const st = document.createElement('style')
        st.textContent = '.tooltip-card{transform:scale(var(--rec-ui,1));transform-origin:top left}'
        host.shadowRoot.appendChild(st)
        uiScaleInjected = true
      }
      document.documentElement.style.setProperty('--rec-ui', String(view.s))
    }
  }

  /* ——— 片头卡抑制：仅视频开场的首个 tab 展示 ———
     同 tab 翻篇：sessionStorage 记忆；跨页落地 tab：URL 带 #__highlight-mark__ hash */
  const intro = document.getElementById('rec-intro')
  if (location.hash || sessionStorage.getItem('rec-nointro'))
    intro?.remove()
  else
    sessionStorage.setItem('rec-nointro', '1')

  /* ——— 覆盖层元素（JS 创建，HTML 页面保持干净） ——— */
  const cursor = document.createElement('div')
  cursor.id = 'rec-cursor'
  cursor.classList.add('hidden') // 首次 setCursor 前不露头（落地 tab 不继承光标位置）
  cursor.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20">
    <path d="M3 2 L3 15.5 L7.2 12.2 L9.6 17.6 L12 16.4 L9.6 11.2 L14.8 11.2 Z"
      fill="#1c1917" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`
  document.body.appendChild(cursor)

  const keys = document.createElement('div')
  keys.id = 'rec-keys'
  document.body.appendChild(keys)

  const cap = document.createElement('div')
  cap.id = 'rec-cap'
  document.body.appendChild(cap)

  /* 解说字幕：caption('文案') 显示 / caption(null) 隐藏；pos='top' 挪到顶部（避开底部 Tooltip）。
     注意：位置 class 只在「显示」时切换——清除时若同步重置位置，芯片会在淡出途中瞬移（闪影） */
  function caption(text, pos) {
    if (!text) {
      cap.classList.remove('show')
      return
    }
    cap.classList.toggle('top', pos === 'top')
    cap.textContent = text
    cap.classList.add('show')
  }

  function setCursor(x, y) {
    cursor.classList.remove('hidden')
    cursor.style.transform = `translate(${x - 2}px, ${y - 2}px)`
  }
  function press(down) {
    cursor.classList.toggle('down', !!down)
  }
  function ripple(x, y) {
    const r = document.createElement('div')
    r.id = 'rec-ripple'
    r.style.left = `${x}px`
    r.style.top = `${y}px`
    document.body.appendChild(r)
    setTimeout(() => r.remove(), 500)
  }
  function showKeys(list, label) {
    if (!list) {
      keys.classList.remove('show')
      return
    }
    keys.innerHTML = list.map(k => `<kbd>${k}</kbd>`).join('') + (label ? `<span>${label}</span>` : '')
    keys.classList.add('show')
  }

  /* ——— 片头 / 空镜 ——— */
  function introOut() {
    const el = document.getElementById('rec-intro')
    if (!el) return
    el.classList.add('out')
    setTimeout(() => el.remove(), 700)
  }
  function outro(title, sub) {
    showKeys(null)
    caption(null)
    cursor.classList.add('hidden')
    document.body.classList.add('outro')
    if (title) { // 收束卡：居中词标 + slogan，与片头呼应
      const el = document.createElement('div')
      el.id = 'rec-outro'
      el.innerHTML = `<span></span>${sub ? '<p></p>' : ''}`
      el.querySelector('span').textContent = title
      if (sub) el.querySelector('p').textContent = sub
      document.body.appendChild(el)
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')))
    }
  }

  /* ——— 时轴信标：供剪辑点计算（restored=高亮恢复，pulse=回跳脉冲） ——— */
  window.__recTimeline = [{ ev: 'dcl', t: performance.now() }]
  let restoredLogged = false
  new MutationObserver((muts) => {
    for (const m of muts) {
      const nodes = m.type === 'childList' ? [...m.addedNodes] : [m.target]
      for (const n of nodes) {
        if (!(n instanceof HTMLElement)) continue
        const isHl = (n.className || '').includes?.('webext-highlight-')
          || n.querySelector?.('[class*="webext-highlight-"]')
        if (!isHl) continue
        if (!restoredLogged) {
          restoredLogged = true
          window.__recTimeline.push({ ev: 'restored', t: performance.now() })
        }
        if (m.type === 'attributes' && (n.getAttribute('style') || '').includes('box-shadow'))
          window.__recTimeline.push({ ev: 'pulse', t: performance.now() })
      }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })

  /* ——— 侧栏 iframe 与篇间链接接入扩展 ——— */
  const ext = new URLSearchParams(location.search).get('ext')
  if (ext) {
    document.getElementById('sp').src = `chrome-extension://${ext}/dist/sidepanel/index.html`
    document.querySelectorAll('.pager a').forEach(a => {
      a.href = a.getAttribute('href').split('?')[0] + location.search
    })
  }

  window.rec = {
    fit, focus, toScreen, toBase,
    setCursor, press, ripple, showKeys, caption,
    introOut, outro,
    scale: () => view.s,
  }
})()
