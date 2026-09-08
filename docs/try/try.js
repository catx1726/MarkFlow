/* try.js — MarkFlow 体验页模拟引擎
 * 保真对齐（SSOT）：
 *   标记形态  src/logic/config.ts::highlightDefaultStyle()（inset 0 -5px 底部色条）
 *   划词判定  src/contentScripts/index.ts:191（altKey && !isCollapsed）
 *   回跳脉冲  src/contentScripts/restorer.ts:379-399（居中 + #fbbf24，0.5s 过渡，1000ms 还原）
 *   快捷键    src/logic/settings.ts:13-14 + src/contentScripts/views/Tooltip.vue:141-150
 *             （Alt+S 默认色快捷保存 / Alt+D 快捷删除已有标记，event.code 判定）
 *   层级管理  src/sidepanel PageSection 折叠模式简版（页面文件夹，组内按物理位置排序）
 *   存储      结构镜像 src/logic/storage.ts 'marks-by-url-storage'
 * 模块：store → anchor → render → tooltip → sidebar → jump → modal → hint
 */
;(() => {
  'use strict'

  /* ——— store ——— */
  const STORE_KEY = 'markflow-try-marks'
  const HINT_KEY = 'markflow-try-hint-dismissed'
  const FLASH_COLOR = '#fbbf24' // 品牌琥珀，对齐 config.ts FLASH_COLOR
  const HIGHLIGHT_HEIGHT = 5 // px，对齐 settings.ts highlightHeight
  const HIGHLIGHT_COLORS = ['#FFFF00', '#99FF99', '#FF9999', '#99CCFF', '#FFCC99'] // 对齐 settings.ts highlightColors
  const DEFAULT_COLOR = HIGHLIGHT_COLORS[0] // 对齐 settings.ts defaultHighlightColor（Alt+S 快捷标记用色）
  const PAGE_ID = document.body.dataset.page
  const PAGE_TITLE = document.body.dataset.title // 对齐 ui.ts:415：创建时记录页面标题
  const PAGES = {
    a: { href: 'index.html', label: '笔记 A' },
    b: { href: 'b.html', label: '笔记 B' },
    c: { href: 'c.html', label: '笔记 C' },
    d: { href: 'd.html', label: '笔记 D' },
  }

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {}
    }
    catch {
      return {}
    }
  }

  function saveAll(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data))
  }

  function pageMarks(pageId) {
    return loadAll()[pageId] || []
  }

  function persistMark(mark) {
    const all = loadAll()
    if (!all[mark.page])
      all[mark.page] = []
    all[mark.page].push(mark)
    saveAll(all)
  }

  function deleteMark(page, id) {
    const all = loadAll()
    all[page] = (all[page] || []).filter(m => m.id !== id)
    saveAll(all)
  }

  /* ——— anchor：段落索引 + 文本偏移 ——— */
  function paras() {
    return Array.from(document.querySelectorAll('main [data-para]'))
  }

  function rangeInSinglePara(range) {
    return paras().find(p => p.contains(range.startContainer) && p.contains(range.endContainer)) || null
  }

  function offsetsInPara(para, range) {
    const pre = document.createRange()
    pre.selectNodeContents(para)
    pre.setEnd(range.startContainer, range.startOffset)
    const start = pre.toString().length
    return { start, end: start + range.toString().length }
  }

  /* 段落文本偏移 → DOM 点。包裹 span 只拆分文本节点，不改变 textContent，偏移始终有效 */
  function pointAtOffset(para, offset) {
    const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT)
    let acc = 0
    let node = walker.nextNode()
    while (node) {
      const len = node.textContent.length
      if (acc + len >= offset)
        return { node, offset: offset - acc }
      acc += len
      node = walker.nextNode()
    }
    return null
  }

  /* ——— render：包裹与拆除 ——— */
  function barShadow(color) {
    return `inset 0 -${HIGHLIGHT_HEIGHT}px 0 0 ${color}`
  }

  /* 即时设色（跳过脉冲过渡）；脉冲时直接用 style.boxShadow 走 CSS transition */
  function setColorInstant(spans, color) {
    for (const sp of spans) sp.style.transition = 'none'
    for (const sp of spans) sp.style.boxShadow = barShadow(color)
    if (spans.length)
      void spans[0].offsetWidth // 强制 reflow
    for (const sp of spans) sp.style.transition = ''
  }

  function wrapRange(para, start, end, color, id) {
    const s = pointAtOffset(para, start)
    const e = pointAtOffset(para, end)
    if (!s || !e)
      return []
    const range = document.createRange()
    range.setStart(s.node, s.offset)
    range.setEnd(e.node, e.offset)
    const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT)
    const nodes = []
    let n = walker.nextNode()
    while (n) {
      if (range.intersectsNode(n))
        nodes.push(n)
      n = walker.nextNode()
    }
    const spans = []
    for (const node of nodes) {
      const from = node === s.node ? s.offset : 0
      const to = node === e.node ? e.offset : node.textContent.length
      if (from >= to)
        continue
      const middle = node.splitText(from)
      middle.splitText(to - from)
      const span = document.createElement('span')
      span.className = 'mark'
      span.dataset.mid = id
      middle.parentNode.insertBefore(span, middle)
      span.appendChild(middle)
      spans.push(span)
    }
    setColorInstant(spans, color)
    return spans
  }

  function spansOf(id) {
    return Array.from(document.querySelectorAll(`[data-mid="${id}"]`))
  }

  function unwrap(id) {
    for (const span of spansOf(id)) {
      const parent = span.parentNode
      span.replaceWith(...span.childNodes)
      parent.normalize()
    }
  }

  /* ——— tooltip ——— */
  const tooltip = document.createElement('div')
  tooltip.id = 'tooltip'
  tooltip.className
    = 'hidden fixed z-50 bg-white dark:bg-neutral-900 border hairline rounded-md px-3 py-2.5 font-mono text-xs text-neutral-700 dark:text-neutral-300'
  tooltip.addEventListener('mousedown', e => e.preventDefault()) // 保住选区

  let pendingRange = null
  let pendingPara = null
  let managingMark = null // 管理气泡当前标记（Alt+D 快捷删除目标）
  let messageTimer = null

  function placeTooltip(rect) {
    tooltip.classList.remove('hidden')
    const sidebarOffset = window.matchMedia('(min-width: 1024px)').matches ? 316 : 16
    const tw = tooltip.offsetWidth
    const th = tooltip.offsetHeight
    let left = rect.left + rect.width / 2 - tw / 2
    left = Math.max(8, Math.min(left, window.innerWidth - sidebarOffset - tw))
    let top = rect.top - th - 8
    if (top < 8)
      top = rect.bottom + 8
    tooltip.style.left = `${left}px`
    tooltip.style.top = `${top}px`
  }

  function closeTooltip() {
    tooltip.classList.add('hidden')
    tooltip.replaceChildren()
    pendingRange = null
    pendingPara = null
    managingMark = null
  }

  function el(tag, className, text) {
    const node = document.createElement(tag)
    if (className)
      node.className = className
    if (text !== undefined)
      node.textContent = text
    return node
  }

  function showMessage(rect, text) {
    tooltip.replaceChildren(el('span', 'text-neutral-400', text))
    placeTooltip(rect)
    clearTimeout(messageTimer)
    messageTimer = setTimeout(closeTooltip, 1500)
  }

  function openCreate(range, para) {
    pendingRange = range
    pendingPara = para
    tooltip.replaceChildren()

    const colorRow = el('div', 'flex items-center gap-2')
    for (const color of HIGHLIGHT_COLORS) {
      const dot = el('button', 'color-dot')
      dot.style.background = color
      dot.setAttribute('aria-label', `标记为 ${color}`)
      dot.addEventListener('click', () => createMark(color))
      colorRow.appendChild(dot)
    }
    tooltip.appendChild(colorRow)
    tooltip.appendChild(el('p', 'mt-1.5 text-neutral-400', 'Alt+S 默认色快捷标记'))

    placeTooltip(range.getBoundingClientRect())
  }

  function openManage(mark) {
    managingMark = mark
    tooltip.replaceChildren()
    const row = el('div', 'flex items-center gap-3')
    const dot = el('span', 'color-dot')
    dot.style.background = mark.color
    row.appendChild(dot)
    const del = el('button', 'link-line', '删除此标记')
    del.addEventListener('click', () => removeMark(mark))
    row.appendChild(del)
    tooltip.appendChild(row)
    tooltip.appendChild(el('p', 'mt-1.5 text-neutral-400', 'Alt+D 快捷删除'))
    const span = spansOf(mark.id)[0]
    if (span)
      placeTooltip(span.getBoundingClientRect())
  }

  function createMark(color) {
    if (!pendingRange || !pendingPara)
      return
    const { start, end } = offsetsInPara(pendingPara, pendingRange)
    const mark = {
      id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      page: PAGE_ID,
      title: PAGE_TITLE, // 对齐 ui.ts:415 title: document.title
      text: pendingRange.toString(),
      color,
      createdAt: Date.now(),
      paraIdx: Number(pendingPara.dataset.para),
      start,
      end,
    }
    wrapRange(pendingPara, start, end, color, mark.id)
    persistMark(mark)
    window.getSelection().removeAllRanges()
    closeTooltip()
    renderSidebar()
  }

  function removeMark(mark) {
    deleteMark(mark.page, mark.id)
    if (mark.page === PAGE_ID)
      unwrap(mark.id)
    closeTooltip()
    renderSidebar()
  }

  function overlapsExisting(range) {
    return Array.from(document.querySelectorAll('[data-mid]')).some(sp => range.intersectsNode(sp))
  }

  /* ——— sidebar：页面文件夹层级管理（PageSection 折叠模式简版；组内按物理位置排序） ——— */
  const brokenIds = new Set() // 恢复定位失败的标记 id（置灰禁跳）
  const groupsBox = document.getElementById('mark-groups')

  function snippet(text) {
    const clean = text.trim().replace(/\s+/g, ' ')
    return clean.length > 24 ? `${clean.slice(0, 24)}…` : clean
  }

  function renderSidebar() {
    if (!groupsBox)
      return
    groupsBox.replaceChildren()
    const all = loadAll()
    const pageIds = Object.keys(PAGES).filter(id => (all[id] || []).length > 0)
    if (!pageIds.length) {
      groupsBox.appendChild(el('p', 'font-mono text-xs text-neutral-400', '按住 Alt 选中文字，即可标记。'))
      return
    }

    for (const pageId of pageIds) {
      const folder = el('div', 'mb-5')
      const marks = all[pageId].slice().sort((x, y) => x.paraIdx - y.paraIdx || x.start - y.start)
      // 取首个有 title 标记（对齐 tagTree.ts:47），无 title 旧数据回退代号
      const title = marks.find(m => m.title)?.title || PAGES[pageId].label

      const header = el('button', 'w-full flex items-baseline gap-2 font-mono text-xs tracking-widest text-left select-none')
      const chevron = el('span', 'text-neutral-400 shrink-0', '▾')
      header.appendChild(chevron)
      const label = el(
        'span',
        pageId === PAGE_ID ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-500 dark:text-neutral-400',
        `${title} · ${marks.length}`,
      )
      header.appendChild(label)
      const body = el('div')
      header.addEventListener('click', () => {
        const collapsed = body.classList.toggle('hidden')
        chevron.textContent = collapsed ? '▸' : '▾'
      })

      for (const m of marks) body.appendChild(markItem(m))
      folder.appendChild(header)
      folder.appendChild(body)
      groupsBox.appendChild(folder)
    }
  }

  function markItem(m) {
    const item = el('div', 'group flex items-baseline gap-2 py-1.5 w-full')
    const dot = el('span', 'shrink-0 self-center')
    dot.style.cssText = `width:8px;height:8px;border-radius:9999px;background:${m.color};display:inline-block`
    item.appendChild(dot)

    const btn = el(
      'button',
      'flex-1 min-w-0 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:text-amber-700 dark:hover:text-amber-400 truncate',
      snippet(m.text),
    )
    if (m.page === PAGE_ID && brokenIds.has(m.id)) {
      btn.classList.add('opacity-40', 'cursor-not-allowed')
      btn.title = '原文定位失败'
    }
    else {
      btn.addEventListener('click', () => jumpTo(m))
    }
    item.appendChild(btn)

    const del = el(
      'button',
      'shrink-0 font-mono text-xs text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-amber-700 dark:hover:text-amber-400',
      '×',
    )
    del.setAttribute('aria-label', '删除标记')
    del.addEventListener('click', () => removeMark(m))
    item.appendChild(del)
    return item
  }

  /* ——— jump：居中 + 琥珀脉冲（对齐 restorer.ts） ——— */
  function pulse(spans, color) {
    for (const sp of spans) sp.style.boxShadow = barShadow(FLASH_COLOR)
    setTimeout(() => {
      for (const sp of spans) sp.style.boxShadow = barShadow(color)
    }, 1000)
  }

  function jumpTo(m) {
    if (m.page !== PAGE_ID) {
      location.href = `${PAGES[m.page].href}#mark-${m.id}` // 跨页，镜像 useMarkActions.ts hash 机制
      return
    }
    const spans = spansOf(m.id)
    if (!spans.length)
      return
    spans[0].scrollIntoView({ block: 'center' }) // behavior: auto（瞬时），对齐 restorer
    pulse(spans, m.color)
  }

  function checkHashJump() {
    const match = location.hash.match(/^#mark-(.+)$/)
    if (!match)
      return
    const id = match[1]
    history.replaceState(null, '', location.pathname + location.search)
    setTimeout(() => {
      const m = pageMarks(PAGE_ID).find(x => x.id === id)
      if (m)
        jumpTo(m)
    }, 100) // 延迟 100ms，对齐 index.ts:76-92
  }

  /* ——— 恢复本页标记 ——— */
  function restorePage() {
    for (const m of pageMarks(PAGE_ID)) {
      const para = paras().find(p => Number(p.dataset.para) === m.paraIdx)
      const ok = para && para.textContent.substring(m.start, m.end) === m.text
      if (!ok) {
        brokenIds.add(m.id)
        continue
      }
      wrapRange(para, m.start, m.end, m.color, m.id)
    }
  }

  /* ——— modal：核心功能说明 ——— */
  const modal = document.getElementById('about-modal')
  function openModal() {
    if (modal)
      modal.classList.remove('hidden')
  }
  function closeModal() {
    if (modal)
      modal.classList.add('hidden')
  }
  const aboutOpen = document.getElementById('about-open')
  if (aboutOpen)
    aboutOpen.addEventListener('click', openModal)
  const aboutClose = document.getElementById('about-close')
  if (aboutClose)
    aboutClose.addEventListener('click', closeModal)
  const aboutBackdrop = document.getElementById('about-backdrop')
  if (aboutBackdrop)
    aboutBackdrop.addEventListener('click', closeModal)

  /* ——— 事件绑定 ——— */
  document.addEventListener('mouseup', (e) => {
    if (tooltip.contains(e.target))
      return
    const sel = window.getSelection()
    if (e.altKey && sel && !sel.isCollapsed) {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const para = rangeInSinglePara(range)
      if (!para)
        return showMessage(rect, '请在同一段落内标记')
      if (overlapsExisting(range))
        return showMessage(rect, '暂不支持重叠标记')
      openCreate(range, para)
    }
    else {
      closeTooltip()
    }
  })

  const main = document.querySelector('main')
  if (main) {
    main.addEventListener('click', (e) => {
      const span = e.target.closest('[data-mid]')
      if (!span)
        return
      const m = pageMarks(PAGE_ID).find(x => x.id === span.dataset.mid)
      if (m)
        openManage(m)
    })
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTooltip()
      closeModal()
      return
    }
    // Alt+S 快捷标记 / Alt+D 快捷删除（对齐 Tooltip.vue:141-150：event.code 判定，仅气泡打开时生效）
    if (tooltip.classList.contains('hidden'))
      return
    const target = e.target
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      return
    if (!e.altKey || e.shiftKey || e.ctrlKey || e.metaKey)
      return
    if (e.code === 'KeyS' && pendingRange) {
      e.preventDefault()
      createMark(DEFAULT_COLOR)
    }
    else if (e.code === 'KeyD' && managingMark) {
      e.preventDefault()
      removeMark(managingMark)
    }
  })
  window.addEventListener('scroll', () => {
    if (!tooltip.classList.contains('hidden'))
      closeTooltip()
  }, { passive: true })
  window.addEventListener('resize', closeTooltip)

  /* ——— hint 与重置 ——— */
  const hint = document.getElementById('hint')
  if (hint && !localStorage.getItem(HINT_KEY))
    hint.classList.remove('hidden')
  const hintClose = document.getElementById('hint-close')
  if (hintClose) {
    hintClose.addEventListener('click', () => {
      localStorage.setItem(HINT_KEY, '1')
      hint.classList.add('hidden')
    })
  }
  const resetBtn = document.getElementById('reset-try')
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(STORE_KEY)
      location.reload()
    })
  }

  /* ——— 启动 ——— */
  document.body.appendChild(tooltip)
  restorePage()
  renderSidebar()
  checkHashJump()
})()
