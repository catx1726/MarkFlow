// 移除 watch, CLEANUP_DAYS_THRESHOLD
import { onMessage, sendMessage } from 'webext-bridge/background'
import type { Tabs } from 'webextension-polyfill'
// src/background/main.ts
import { toRaw } from 'vue'
import {
  type Mark,
  marksByUrl,
  dataReady,
  tagsMetadata,
  tagsReady,
  type RemoveMarkPayload,
  type UpdateMarkNotePayload,
  type GetMarkByIdPayload
} from '~/logic/storage'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  // load latest content script
  import('./contentScriptHMR')
}

import { collectError } from '../logic/errorCollector'
window.addEventListener('error', (event) => collectError(event.error, 'background'))
window.addEventListener('unhandledrejection', (event) => collectError(event.reason, 'background'))

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

// 写操作队列，用于序列化对 marksByUrl 和 tagsMetadata 的并发写操作
let writeQueue: Promise<unknown> = Promise.resolve()

function enqueueWrite<T>(writeFn: () => Promise<T>): Promise<T> {
  // 即使前一个写操作失败，当前写操作也要继续排队执行，确保序列化不被破坏
  const result = writeQueue.then(() => writeFn(), () => writeFn())
  writeQueue = result.catch(() => {})
  result.then(
    () => { browser.runtime.sendMessage({ type: 'refresh-sidepanel-data' }).catch(() => {}) },
    () => { browser.runtime.sendMessage({ type: 'refresh-sidepanel-data' }).catch(() => {}) }
  )
  return result
}

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
  try {
    console.log('Adding new mark:', data)
    const { url } = data
    await enqueueWrite(async () => {
      if (!marksByUrl.value[url]) marksByUrl.value[url] = []
      marksByUrl.value[url].push(data)
      marksByUrl.value = { ...marksByUrl.value }
    })
    return { success: true }
  }
  catch (error) {
    console.error('Failed to add mark:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage('remove-mark', async ({ data: markToRemove }) => {
  try {
    const { url, id } = markToRemove
    await enqueueWrite(async () => {
      if (marksByUrl.value[url]) {
        marksByUrl.value[url] = marksByUrl.value[url].filter((m) => m.id !== id)
        if (marksByUrl.value[url].length === 0) delete marksByUrl.value[url]
        marksByUrl.value = { ...marksByUrl.value }
      }
    })
    return { success: true }
  }
  catch (error) {
    console.error('Failed to remove mark:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage('get-marks-for-url', async ({ data }) => {
  await dataReady
  const { url } = data
  return (marksByUrl.value[url] || []).map(toRaw)
})

onMessage<RemoveMarkPayload>('remove-mark-by-id', async ({ data }) => {
  try {
    const { url, id } = data
    await enqueueWrite(async () => {
      if (marksByUrl.value[url]) {
        marksByUrl.value[url] = marksByUrl.value[url].filter((m) => m.id !== id)
        if (marksByUrl.value[url].length === 0) delete marksByUrl.value[url]
        marksByUrl.value = { ...marksByUrl.value }
      }
    })
    return { success: true }
  }
  catch (error) {
    console.error('Failed to remove mark by id:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage<UpdateMarkNotePayload>('update-mark-note', async ({ data }) => {
  try {
    const { url, id, note } = data
    await enqueueWrite(async () => {
      if (marksByUrl.value[url]) {
        const markToUpdate = marksByUrl.value[url].find((m) => m.id === id)
        if (markToUpdate) {
          markToUpdate.note = note
          marksByUrl.value = { ...marksByUrl.value }
        }
      }
    })
    return { success: true }
  }
  catch (error) {
    console.error('Failed to update mark note:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage<any>('update-mark-details', async ({ data }) => {
  try {
    const { url, id, ...updates } = data
    await enqueueWrite(async () => {
      if (marksByUrl.value[url]) {
        const index = marksByUrl.value[url].findIndex((m) => m.id === id)
        if (index !== -1) {
          const markToUpdate = marksByUrl.value[url][index]
          Object.assign(markToUpdate, updates)
          marksByUrl.value = { ...marksByUrl.value }
          console.log(`[background] Mark ${id} updated successfully`)
        }
      }
    })
    return { success: true }
  }
  catch (error) {
    console.error('Failed to update mark details:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage<GetMarkByIdPayload>('get-mark-by-id', async ({ data }) => {
  const { url, id } = data
  if (marksByUrl.value[url]) {
    const markProxy = marksByUrl.value[url].find((m) => m.id === id)
    if (markProxy) return toRaw(markProxy)
  }
  return undefined
})

onMessage('get-storage-usage', async () => {
  const usage = await (browser.storage.local as any).getBytesInUse()
  const rawQuota = (browser.storage.local as any).QUOTA_BYTES
  const quota = typeof rawQuota === 'number' ? rawQuota : 10 * 1024 * 1024
  return { usage, quota }
})

onMessage('cleanup-old-marks', async ({ data }) => {
  try {
    const { days } = data
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000
    await enqueueWrite(async () => {
      const allMarks = marksByUrl.value
      const keptMarks = Object.values(allMarks)
        .flat()
        .filter((mark: Mark) => mark.createdAt > threshold)

      marksByUrl.value = keptMarks.reduce((acc, mark) => {
        if (!acc[mark.url]) acc[mark.url] = []
        acc[mark.url].push(mark)
        return acc
      }, {} as Record<string, Mark[]>)
    })
    return { success: true }
  }
  catch (error) {
    console.error('Failed to cleanup old marks:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage('cleanup-useless-marks', async () => {
  try {
    await enqueueWrite(async () => {
      const allMarks = marksByUrl.value
      const keptMarks = Object.values(allMarks)
        .flat()
        .filter((mark: Mark) => mark.note && mark.note.trim() !== '')

      marksByUrl.value = keptMarks.reduce((acc, mark) => {
        if (!acc[mark.url]) acc[mark.url] = []
        acc[mark.url].push(mark)
        return acc
      }, {} as Record<string, Mark[]>)
    })
    return { success: true }
  }
  catch (error) {
    console.error('Failed to cleanup useless marks:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage<{ tabId: number }>('open-sidepanel', async ({ data }) => {
  const { tabId } = data
  if (!tabId) return { success: false, error: 'Tab ID missing' }

  try {
    // @ts-expect-error missing types
    if (browser.sidePanel && typeof (browser.sidePanel as any).open === 'function') {
      // @ts-expect-error missing types
      await (browser.sidePanel as any).open({ tabId })
      return { success: true, browser: 'Chrome' }
    }
    return { success: false, error: 'Side panel/Sidebar API not found.' }
  } catch (e) {
    console.error('Failed to open side panel/sidebar:', e)
    return { success: false, error: `API call failed: ${(e as Error).message}` }
  }
})

onMessage<{ url: string }>('remove-marks-by-url', async ({ data }) => {
  try {
    const { url } = data
    await enqueueWrite(async () => {
      if (marksByUrl.value[url]) {
        delete marksByUrl.value[url]
        marksByUrl.value = { ...marksByUrl.value }
      }
    })
    return { success: true }
  }
  catch (error) {
    console.error('Failed to remove marks by url:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage<{ marks: any[] }>('remove-marks', async ({ data }) => {
  try {
    const { marks } = data
    await enqueueWrite(async () => {
      for (const mark of marks) {
        const { url, id } = mark
        if (marksByUrl.value[url]) {
          marksByUrl.value[url] = marksByUrl.value[url].filter((m) => m.id !== id)
          if (marksByUrl.value[url].length === 0) {
            delete marksByUrl.value[url]
          }
        }
      }
      marksByUrl.value = { ...marksByUrl.value }
    })
    return { success: true }
  }
  catch (error) {
    console.error('Failed to remove marks:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage('get-all-marks', async () => {
  await dataReady
  const result: Record<string, Mark[]> = {}
  Object.entries(marksByUrl.value).forEach(([url, marks]) => {
    result[url] = marks.map(toRaw)
  })
  return result
})

onMessage('get-all-tags', async () => {
  await tagsReady
  return toRaw(tagsMetadata.value)
})

onMessage('refresh-sidepanel-data', async () => {
  await browser.runtime.sendMessage({ type: 'refresh-sidepanel-data' }).catch(() => {})
})

onMessage('open-options-page', async () => {
  browser.runtime.openOptionsPage()
})

/**
 * 专门的消息处理器用于创建标签，解决 Content Script 直接修改存储的问题
 */
onMessage<{ name: string, color?: string }>('create-tag', async ({ data }) => {
  try {
    const { name, color = '#3B82F6' } = data
    const id = `tag-${Date.now()}`
    const newTag = { id, name, color, isAutoGenerated: false, createdAt: Date.now() }
    await enqueueWrite(async () => {
      tagsMetadata.value = { ...tagsMetadata.value, [id]: newTag }
    })
    return newTag
  }
  catch (error) {
    console.error('Failed to create tag:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage<{ tagId: string, name: string }>('rename-tag', async ({ data }) => {
  try {
    const { tagId, name } = data
    await enqueueWrite(async () => {
      if (tagsMetadata.value[tagId]) {
        tagsMetadata.value[tagId] = { ...tagsMetadata.value[tagId], name }
        tagsMetadata.value = { ...tagsMetadata.value }
      }
    })
    return { success: true }
  }
  catch (error) {
    console.error('Failed to rename tag:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage<{ tagId: string }>('delete-tag', async ({ data }) => {
  try {
    const { tagId } = data
    await enqueueWrite(async () => {
      if (tagsMetadata.value[tagId]) {
        delete tagsMetadata.value[tagId]
        tagsMetadata.value = { ...tagsMetadata.value }

        // 优化：先构建新对象再一次性赋值，减少响应式触发次数
        // 注意：如果标记数量极大，此操作可能阻塞写队列。当前假设正常使用场景下数据量在可控范围。
        const updatedMarksByUrl = { ...marksByUrl.value }
        Object.entries(updatedMarksByUrl).forEach(([url, marks]) => {
          updatedMarksByUrl[url] = marks.map(m => {
            if (m.tags?.includes(tagId)) {
              return { ...m, tags: m.tags.filter(t => t !== tagId) }
            }
            return m
          })
        })
        marksByUrl.value = updatedMarksByUrl
      }
    })
    return { success: true }
  }
  catch (error) {
    console.error('Failed to delete tag:', error)
    return { success: false, error: (error as Error).message }
  }
})

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') browser.runtime.openOptionsPage()
})
