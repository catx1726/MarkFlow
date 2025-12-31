// 移除 watch, CLEANUP_DAYS_THRESHOLD
import { onMessage, sendMessage } from 'webext-bridge/background'
import type { Tabs } from 'webextension-polyfill'
// src/background/main.ts
import { toRaw } from 'vue'
import {
  type Mark,
  marksByUrl,
  dataReady,
  type RemoveMarkPayload,
  type UpdateMarkNotePayload,
  GetMarkByIdPayload
} from '~/logic/storage'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  // load latest content script
  import('./contentScriptHMR')
}

// remove or turn this off if you don't use side panel
const USE_SIDE_PANEL = true

// to toggle the sidepanel with the action button in chromium:
// @ts-expect-error missing types
if (USE_SIDE_PANEL && globalThis.browser?.sidePanel) {
  // @ts-expect-error missing types
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => console.error(error))
}

browser.runtime.onInstalled.addListener((): void => {
  // eslint-disable-next-line no-console
  console.log('Extension installed')
})

let previousTabId = 0

// communication example: send previous tab title from background page
// see shim.d.ts for type declaration
browser.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!previousTabId) {
    previousTabId = tabId
    return
  }

  let tab: Tabs.Tab

  try {
    tab = await browser.tabs.get(previousTabId)
    previousTabId = tabId
  } catch {
    return
  }

  // eslint-disable-next-line no-console
  console.log('previous tab', tab)
  sendMessage('tab-prev', { title: tab.title }, { context: 'content-script', tabId })
})

onMessage('get-current-tab', async () => {
  try {
    const tab = await browser.tabs.get(previousTabId)
    return {
      title: tab?.title
    }
  } catch {
    return {
      title: undefined
    }
  }
})

onMessage('add-mark', async ({ data }) => {
  console.log('Adding new mark:', data)
  const { url } = data
  if (!marksByUrl.value[url]) marksByUrl.value[url] = []

  marksByUrl.value[url].push(data)
})

onMessage('remove-mark', async ({ data: markToRemove }) => {
  const { url, id } = markToRemove
  if (marksByUrl.value[url]) {
    marksByUrl.value[url] = marksByUrl.value[url].filter((m) => m.id !== id)

    // 如果该 URL 下已无标记，则删除此 URL 条目
    if (marksByUrl.value[url].length === 0) delete marksByUrl.value[url]
  }
})

onMessage('get-marks-for-url', async ({ data }) => {
  console.log(`[background] Received get-marks-for-url for: ${data.url}`)
  await dataReady
  console.log(`[background] Storage is ready. dataReady.value is: ${dataReady}`)
  const { url } = data
  const resultProxy = marksByUrl.value[url] || []

  // 优化修正：对数组中的每个元素应用 toRaw，确保返回一个纯净的数组
  const result = resultProxy.map(toRaw)

  console.log(`[background] Returning ${result.length} marks for ${url}`)
  return result
})

onMessage<RemoveMarkPayload>('remove-mark-by-id', async ({ data }) => {
  const { url, id } = data
  if (marksByUrl.value[url]) {
    marksByUrl.value[url] = marksByUrl.value[url].filter((m) => m.id !== id)

    if (marksByUrl.value[url].length === 0) delete marksByUrl.value[url]
  }
})

onMessage<UpdateMarkNotePayload>('update-mark-note', async ({ data }) => {
  const { url, id, note } = data
  if (marksByUrl.value[url]) {
    const markToUpdate = marksByUrl.value[url].find((m) => m.id === id)
    if (markToUpdate) markToUpdate.note = note
  }
})

onMessage<UpdateMarkNotePayload>('update-mark-details', async ({ data }) => {
  const { url, id, note, color } = data
  if (marksByUrl.value[url]) {
    const markToUpdate = marksByUrl.value[url].find((m) => m.id === id)
    if (markToUpdate) {
      if (note !== undefined) markToUpdate.note = note

      if (color !== undefined) markToUpdate.color = color
    }
  }
})

onMessage<GetMarkByIdPayload>('get-mark-by-id', async ({ data }) => {
  const { url, id } = data
  if (marksByUrl.value[url]) {
    // 1. 找到响应式对象
    const markProxy = marksByUrl.value[url].find((m) => m.id === id)

    // 2. 核心修正：返回之前使用 toRaw() 剥离 Proxy
    if (markProxy) {
      return toRaw(markProxy) // <-- 使用 toRaw 返回纯 JS 对象
    }
  }
  return undefined
})

onMessage('get-storage-usage', async () => {
  const usage = await browser.storage.local.getBytesInUse()

  // 1. 尝试从 browser.storage.local 获取 QUOTA_BYTES
  // 仅 Chrome/Edge (5MB) 会有值，Firefox 为 undefined
  const rawQuota = (browser.storage.local as any).QUOTA_BYTES

  let quota: number | null

  if (typeof rawQuota === 'number') {
    // 2. 如果 rawQuota 是数字 (Chrome/Edge)，则使用它
    quota = rawQuota
  } else {
    // 3. 如果 rawQuota 不存在 (Firefox)，则返回 null，
    //    表示浏览器没有提供官方的 API 常量来获取此限制。
    //    (如果您想硬编码 10MB 的 Firefox 限制，可以改为 10 * 1024 * 1024)
    quota = 10 * 1024 * 1024
  }

  return { usage, quota }
})

onMessage('cleanup-old-marks', async ({ data }) => {
  const { days } = data
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000
  const allMarks = marksByUrl.value // <-- 修正
  const keptMarks = Object.values(allMarks)
    .flat()
    .filter((mark: Mark) => mark.createdAt > threshold) // <-- 为 mark 显式添加类型

  // 重新构建以 URL 分组的 marks 对象
  marksByUrl.value = keptMarks.reduce((acc, mark) => {
    // <-- 修正
    if (!acc[mark.url]) acc[mark.url] = []
    acc[mark.url].push(mark)
    return acc
  }, {} as Record<string, Mark[]>) // <-- 为初始值添加类型断言
})

onMessage('cleanup-useless-marks', () => {
  const allMarks = marksByUrl.value // <-- 修正
  const keptMarks = Object.values(allMarks)
    .flat()
    .filter((mark: Mark) => mark.note && mark.note.trim() !== '') // <-- 为 mark 显式添加类型

  marksByUrl.value = keptMarks.reduce((acc, mark) => {
    // <-- 修正
    if (!acc[mark.url]) acc[mark.url] = []
    acc[mark.url].push(mark)
    return acc
  }, {} as Record<string, Mark[]>) // <-- 为初始值添加类型断言
})

onMessage<{ tabId: number }>('open-sidepanel', async ({ data }) => {
  console.log('[web-marker-extension] Opening side panel', data)

  const { tabId } = data

  if (!tabId) {
    console.error('Tab ID missing for opening side panel.')
    return { success: false, error: 'Tab ID missing' }
  }

  try {
    // @ts-expect-error missing types
    if (browser.sidePanel && typeof (browser.sidePanel as any).open === 'function') {
      // Chrome (MV3) 需要一个 tabId
      const tabId = data?.tabId
      if (!tabId) {
        console.error('Tab ID missing for opening side panel in Chrome.')
        return { success: false, error: 'Tab ID missing for Chrome' }
      }
      // @ts-expect-error missing types
      await (browser.sidePanel as any).open({ tabId })
      return { success: true, browser: 'Chrome' }
    }

    // 3. Fallback
    return { success: false, error: 'Side panel/Sidebar API not found.' }
  } catch (e) {
    console.error('Failed to open side panel/sidebar:', e)
    // 返回一个明确的错误信息
    return { success: false, error: `API call failed: ${(e as Error).message}` }
  }
})

onMessage<{ url: string }>('remove-marks-by-url', async ({ data }) => {
  const { url } = data
  if (marksByUrl.value[url]) {
    delete marksByUrl.value[url]
  }
})

onMessage('refresh-sidepanel-data', async () => {
  console.log('[background] Broadcasting refresh-sidepanel-data via native messaging')
  // 使用原生消息广播给所有扩展页面（包括 Sidepanel, Popup, Options）
  // 这绕过了 webext-bridge 的上下文路由限制，确保所有打开的 Sidepanel 都能收到通知
  await browser.runtime.sendMessage({ type: 'refresh-sidepanel-data' }).catch(() => {
    // 如果没有接收者（例如 Sidepanel 未打开），忽略错误
  })
})

/**
 * 当扩展首次安装时，自动打开配置页面。
 */
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') browser.runtime.openOptionsPage()
})
