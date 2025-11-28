import { until } from '@vueuse/core'
import { onMessage, sendMessage } from 'webext-bridge/background'
import type { Tabs } from 'webextension-polyfill'
// src/background/main.ts
import { marksByUrl, dataReady } from '~/logic/storage' // 引入我们创建的 storage

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
if (USE_SIDE_PANEL) {
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
  await until(dataReady).toBe(true)
  console.log(`[background] Storage is ready. dataReady.value is: ${dataReady}`)
  const { url } = data
  const result = marksByUrl.value[url] || []
  console.log(`[background] Returning ${result.length} marks for ${url}`)
  return result
})
