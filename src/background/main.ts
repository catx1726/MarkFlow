// 移除 watch, CLEANUP_DAYS_THRESHOLD
import { onMessage, sendMessage } from 'webext-bridge/background'
import type { Tabs } from 'webextension-polyfill'
// src/background/main.ts
import { toRaw } from 'vue'
import { debounce } from 'lodash-es'
import { collectError } from '../logic/errorCollector'
import {
  type GetMarkByIdPayload,
  type Mark,
  type RemoveMarkPayload,
  type UpdateMarkNotePayload,
  dataReady,
  marksByUrl,
  statusReady,
  syncConfig,
  syncReady,
  syncStatus,
  tagsMetadata,
  tagsReady,
} from '~/logic/storage'
import { getGists, mergeMarks, mergeTags, updateGist } from '~/logic/sync'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  // load latest content script
  import('./contentScriptHMR')
}
window.addEventListener('error', event => collectError(event.error, 'background'))
window.addEventListener('unhandledrejection', event => collectError(event.reason, 'background'))

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
async function ensureReady(timeoutMs = 5000) {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      reject(new Error(`[ensureReady] Storage initialization timed out after ${timeoutMs}ms - blocking operation to prevent accidental data overwrite`))
    }, timeoutMs),
  )
  await Promise.race([
    Promise.all([dataReady, tagsReady, syncReady, statusReady]),
    timeoutPromise,
  ])
}
let previousTabId = 0

// 写操作队列，用于序列化对 marksByUrl 和 tagsMetadata 的并发写操作
let writeQueue: Promise<unknown> = Promise.resolve()

function enqueueWrite<T>(writeFn: () => Promise<T>): Promise<T> {
  // 即使前一个写操作失败，当前写操作也要继续排队执行，确保序列化不被破坏
  const result = writeQueue.then(() => writeFn(), () => writeFn())
  writeQueue = result.catch((error) => {
    console.error('[enqueueWrite] Write operation failed:', error)
    return undefined
  })
  result.then(
    () => { browser.runtime.sendMessage({ type: 'refresh-sidepanel-data' }).catch(() => {}) },
    (error) => {
      console.error('[enqueueWrite] Broadcast skipped due to write failure:', error)
    },
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
  }
  catch {
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
      title: tab?.title,
    }
  }
  catch {
    return {
      title: undefined,
    }
  }
})

onMessage('add-mark', async ({ data }) => {
  await ensureReady()
  try {
    // eslint-disable-next-line no-console
    console.log('Adding new mark:', data)
    const { url } = data
    await enqueueWrite(async () => {
      if (!marksByUrl.value[url])
        marksByUrl.value[url] = []
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
  await ensureReady()
  try {
    const { url, id } = markToRemove
    await enqueueWrite(async () => {
      if (marksByUrl.value[url]) {
        const mark = marksByUrl.value[url].find(m => m.id === id)
        if (mark) {
          mark.deletedAt = Date.now()
          marksByUrl.value = { ...marksByUrl.value }
        }
      }
    })
    if (!syncConfig.value.enabled)
      await purgeTombstones()
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
  return (marksByUrl.value[url] || [])
    .filter(m => !m.deletedAt)
    .map(toRaw)
})

onMessage<RemoveMarkPayload>('remove-mark-by-id', async ({ data }) => {
  await ensureReady()
  try {
    const { url, id } = data
    await enqueueWrite(async () => {
      if (marksByUrl.value[url]) {
        const mark = marksByUrl.value[url].find(m => m.id === id)
        if (mark) {
          mark.deletedAt = Date.now()
          marksByUrl.value = { ...marksByUrl.value }
        }
      }
    })
    if (!syncConfig.value.enabled)
      await purgeTombstones()
    return { success: true }
  }
  catch (error) {
    console.error('Failed to remove mark by id:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage<UpdateMarkNotePayload>('update-mark-note', async ({ data }) => {
  await ensureReady()
  try {
    const { url, id, note } = data
    await enqueueWrite(async () => {
      if (marksByUrl.value[url]) {
        const markToUpdate = marksByUrl.value[url].find(m => m.id === id)
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
  await ensureReady()
  try {
    const { url, id, ...updates } = data
    await enqueueWrite(async () => {
      if (marksByUrl.value[url]) {
        const index = marksByUrl.value[url].findIndex(m => m.id === id)
        if (index !== -1) {
          const markToUpdate = marksByUrl.value[url][index]
          Object.assign(markToUpdate, updates)
          marksByUrl.value = { ...marksByUrl.value }

          // eslint-disable-next-line no-console
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
  await ensureReady()
  const { url, id } = data
  if (marksByUrl.value[url]) {
    const markProxy = marksByUrl.value[url].find(m => m.id === id)
    if (markProxy)
      return toRaw(markProxy)
  }
  return undefined
})

onMessage('get-storage-usage', async () => {
  const usage = await (browser.storage.local as any).getBytesInUse()
  const rawQuota = (browser.storage.local as any).QUOTA_BYTES
  const quota = typeof rawQuota === 'number' ? rawQuota : 10 * 1024 * 1024

  // 可观测性增强：如果存储占用超过 80%，记录一条警告日志
  if (usage > quota * 0.8) {
    const usageMB = (usage / 1024 / 1024).toFixed(2)
    const quotaMB = (quota / 1024 / 1024).toFixed(2)
    collectError(new Error(`[Storage Warning] Local storage is almost full: ${usageMB}MB / ${quotaMB}MB`), 'background')
  }

  return { usage, quota }
})

onMessage('cleanup-old-marks', async ({ data }) => {
  await ensureReady()
  try {
    const { days } = data
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000
    await enqueueWrite(async () => {
      const allMarks = marksByUrl.value
      const keptMarks = Object.values(allMarks)
        .flat()
        .filter((mark: Mark) => mark.createdAt > threshold)

      marksByUrl.value = keptMarks.reduce((acc, mark) => {
        if (!acc[mark.url])
          acc[mark.url] = []
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
  await ensureReady()
  try {
    await enqueueWrite(async () => {
      const allMarks = marksByUrl.value
      const keptMarks = Object.values(allMarks)
        .flat()
        .filter((mark: Mark) => mark.note && mark.note.trim() !== '')

      marksByUrl.value = keptMarks.reduce((acc, mark) => {
        if (!acc[mark.url])
          acc[mark.url] = []
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
  if (!tabId)
    return { success: false, error: 'Tab ID missing' }

  try {
    // @ts-expect-error missing types
    if (browser.sidePanel && typeof (browser.sidePanel as any).open === 'function') {
      // @ts-expect-error missing types
      await (browser.sidePanel as any).open({ tabId })
      return { success: true, browser: 'Chrome' }
    }
    return { success: false, error: 'Side panel/Sidebar API not found.' }
  }
  catch (e) {
    console.error('Failed to open side panel/sidebar:', e)
    return { success: false, error: `API call failed: ${(e as Error).message}` }
  }
})

onMessage<{ url: string }>('remove-marks-by-url', async ({ data }) => {
  await ensureReady()
  try {
    const { url } = data
    await enqueueWrite(async () => {
      if (marksByUrl.value[url]) {
        const now = Date.now()
        marksByUrl.value[url].forEach((m) => {
          if (!m.deletedAt)
            m.deletedAt = now
        })
        marksByUrl.value = { ...marksByUrl.value }
      }
    })
    // 如果未开启同步，立即物理清理以避免残留；否则由同步流程负责清理
    if (!syncConfig.value.enabled)
      await purgeTombstones()
    return { success: true }
  }
  catch (error) {
    console.error('Failed to remove marks by url:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage<{ marks: any[] }>('remove-marks', async ({ data }) => {
  await ensureReady()
  try {
    const { marks } = data
    await enqueueWrite(async () => {
      const now = Date.now()
      for (const mToRemove of marks) {
        const { url, id } = mToRemove
        if (marksByUrl.value[url]) {
          const mark = marksByUrl.value[url].find(m => m.id === id)
          if (mark) {
            mark.deletedAt = now
          }
        }
      }
      marksByUrl.value = { ...marksByUrl.value }
    })
    if (!syncConfig.value.enabled)
      await purgeTombstones()
    return { success: true }
  }
  catch (error) {
    console.error('Failed to remove marks:', error)
    return { success: false, error: (error as Error).message }
  }
})

onMessage('get-all-marks', async () => {
  await ensureReady()
  const result: Record<string, Mark[]> = {}
  Object.entries(marksByUrl.value).forEach(([url, marks]) => {
    result[url] = marks.map(toRaw)
  })
  return result
})

onMessage('get-all-tags', async () => {
  await ensureReady()
  return toRaw(tagsMetadata.value)
})

onMessage('refresh-sidepanel-data', async () => {
  await browser.runtime.sendMessage({ type: 'refresh-sidepanel-data' }).catch(() => {})
})

onMessage('open-options-page', async () => {
  browser.runtime.openOptionsPage()
})

onMessage('trigger-sync', async () => {
  await performPull()
})

onMessage('report-error', async ({ data, context: _context }) => {
  const { message, stack, type = 'background' } = data
  await collectError({ message, stack }, type)
})

/**
 * 专门的消息处理器用于创建标签，解决 Content Script 直接修改存储的问题
 */
onMessage<{ name: string, color?: string }>('create-tag', async ({ data }) => {
  await ensureReady()
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
  await ensureReady()
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

// --- 同步引擎逻辑 ---

/**
 * 同步状态标识，用于防止 Pull 引起的回响推送 (Echo Push)
 */
let isSyncing = false

/**
 * 同步任务队列，确保所有 Push 和 Pull 操作按顺序串行执行，防止数据竞争。
 */
let syncQueue: Promise<void> = Promise.resolve()

async function enqueueSync(task: () => Promise<void>) {
  const nextSync = syncQueue.then(task).catch((err) => {
    console.error('[Sync] Queue task failed:', err)
  })
  syncQueue = nextSync
  return nextSync
}

/**
 * 物理清理已标记删除的记录 (Tombstones)
 * 为了确保多端同步可靠，Tombstone 会保留一段时间（如 7 天）
 */
async function purgeTombstones() {
  const updatedMarksByUrl = { ...marksByUrl.value }
  let hasCleanup = false
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()

  for (const [url, marks] of Object.entries(updatedMarksByUrl)) {
    // 仅清理超过 7 天的 Tombstone，或者如果同步未开启，则视情况清理
    const filteredMarks = marks.filter((m) => {
      if (!m.deletedAt)
        return true
      // 如果开启了同步，必须等待 7 天以确保其他设备有机会拉取
      if (syncConfig.value.enabled) {
        return (now - m.deletedAt) < SEVEN_DAYS_MS
      }
      // 如果未开启同步，立即清理
      return false
    })

    if (filteredMarks.length === 0) {
      delete updatedMarksByUrl[url]
      hasCleanup = true
    }
    else if (filteredMarks.length !== marks.length) {
      updatedMarksByUrl[url] = filteredMarks
      hasCleanup = true
    }
  }
  if (hasCleanup) {
    marksByUrl.value = updatedMarksByUrl
    // eslint-disable-next-line no-console
    console.log('[Sync] Tombstones purged successfully')
    browser.runtime.sendMessage({ type: 'refresh-sidepanel-data' }).catch(() => {})
  }
}

const performPush = debounce(async () => {
  if (isSyncing || !syncConfig.value.enabled || !syncConfig.value.token || !syncConfig.value.gistId)
    return

  await enqueueSync(async () => {
    isSyncing = true
    try {
      // eslint-disable-next-line no-console
      console.log('[Sync] Starting background push...')
      const payload = {
        marks: toRaw(marksByUrl.value),
        tags: toRaw(tagsMetadata.value),
        lastSync: Date.now(),
      }

      // 监控 Payload 大小 (GitHub API 限制约为 10MB)
      const payloadString = JSON.stringify(payload)
      const payloadSize = payloadString.length
      const LIMIT_8MB = 8 * 1024 * 1024

      if (payloadSize > LIMIT_8MB) {
        const sizeMB = (payloadSize / (1024 * 1024)).toFixed(2)
        const warningMsg = `[Sync Warning] 同步数据量接近限制 (${sizeMB}MB / 10MB)。建议清理不再需要的标记以确保同步稳定。`
        // 写入持久化日志，方便开发者诊断
        collectError(new Error(warningMsg), 'background')
        // 更新 UI 提示
        await enqueueWrite(async () => {
          syncStatus.value.errorMessage = warningMsg
        })
      }

      const success = await updateGist(syncConfig.value.token, syncConfig.value.gistId, payload)
      if (success) {
        await enqueueWrite(async () => {
          syncStatus.value.lastSyncTime = Date.now()
          syncStatus.value.lastSyncStatus = 'success'
          // 仅在非警告状态下清除错误消息，保留空间预警
          if (payloadSize <= LIMIT_8MB) {
            syncStatus.value.errorMessage = ''
          }
          await purgeTombstones()
        })
        // eslint-disable-next-line no-console
        console.log('[Sync] Background push successful')
      }
    }
    catch (error: any) {
      console.error('[Sync] Background push failed:', error)
      await enqueueWrite(async () => {
        syncStatus.value.lastSyncStatus = 'error'
        let errorMsg = error.message

        // 处理 GitHub 达到存储上限的特定错误 (422 Unprocessable Entity)
        if (error.status === 422 || error.message.includes('422')) {
          errorMsg = '同步失败：数据量超过 GitHub Gist 上限 (10MB)。请清理部分标记后重试。'
          collectError(new Error(`[Sync Critical] Storage limit exceeded (422): ${error.message}`), 'background')
        }

        syncStatus.value.errorMessage = errorMsg
        // 如果是身份验证问题，自动禁用同步以防止重复报错
        if (error.message.includes('身份验证失败')) {
          syncConfig.value.enabled = false
        }
      })
    }
    finally {
      isSyncing = false
    }
  })
}, 10000)

async function performPull(retries = 3) {
  if (isSyncing)
    return
  await ensureReady()
  if (!syncConfig.value.enabled || !syncConfig.value.token || !syncConfig.value.gistId)
    return

  await enqueueSync(async () => {
    isSyncing = true
    try {
      for (let i = 0; i < retries; i++) {
        try {
          // eslint-disable-next-line no-console
          console.log(`[Sync] Starting initial pull (attempt ${i + 1})...`)
          const gists = await getGists(syncConfig.value.token)
          const gist = gists.find(g => g.id === syncConfig.value.gistId)
          const file = gist?.files['markflow_sync.json']

          if (file && file.content) {
            const remoteData = JSON.parse(file.content)

            await enqueueWrite(async () => {
              marksByUrl.value = mergeMarks(toRaw(marksByUrl.value), remoteData.marks || {})
              tagsMetadata.value = mergeTags(toRaw(tagsMetadata.value), remoteData.tags || {})
              syncStatus.value.lastSyncTime = Date.now()
              syncStatus.value.lastSyncStatus = 'success'
              syncStatus.value.errorMessage = ''

              await purgeTombstones()
              browser.runtime.sendMessage({ type: 'refresh-sidepanel-data' }).catch(() => {})
            })

            // eslint-disable-next-line no-console
            console.log('[Sync] Initial pull and merge successful')
          }
          return // 成功则退出
        }
        catch (error: any) {
          if (error.message.includes('身份验证失败')) {
            await enqueueWrite(async () => {
              syncConfig.value.enabled = false
              syncStatus.value.lastSyncStatus = 'error'
              syncStatus.value.errorMessage = error.message
            })
            return // 认证失败无需重试
          }

          if (i === retries - 1) {
            console.error('[Sync] Initial pull failed after retries:', error)
            await enqueueWrite(async () => {
              syncStatus.value.lastSyncStatus = 'error'
              syncStatus.value.errorMessage = error.message
            })
          }
          else {
            const delay = 2 ** i * 1000

            console.warn(`[Sync] Pull failed, retrying in ${delay}ms...`, error)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }
    }
    finally {
      isSyncing = false
    }
  })
}
// 监听存储变化触发推送
browser.storage.onChanged.addListener((changes) => {
  if (changes['marks-by-url-storage'] || changes['webmarker-tags-metadata']) {
    performPush()
  }

  // 监听同步配置变更，仅处理启用状态切换。
  // 初次连接时的拉取由 Options 页面主动触发，避免竞态。
  if (changes['webmarker-sync-config']) {
    const newValue = changes['webmarker-sync-config'].newValue as SyncConfig
    const oldValue = changes['webmarker-sync-config'].oldValue as SyncConfig
    if (newValue?.enabled && !oldValue?.enabled && newValue?.gistId) {
      performPull()
    }
  }
})

// 启动时拉取
performPull()

onMessage<{ tagId: string }>('delete-tag', async ({ data }) => {
  await ensureReady()
  try {
    const { tagId } = data
    await enqueueWrite(async () => {
      if (tagsMetadata.value[tagId]) {
        delete tagsMetadata.value[tagId]
        tagsMetadata.value = { ...tagsMetadata.value }

        // 优化：先构建新对象再一次性赋值，减少响应式触发次数
        // 分批处理以避免大数据量时阻塞写队列，每批最多处理 500 个 URL
        const BATCH_SIZE = 500
        const entries = Object.entries(marksByUrl.value)
        const updatedMarksByUrl = { ...marksByUrl.value }
        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
          const batch = entries.slice(i, i + BATCH_SIZE)
          batch.forEach(([url, marks]) => {
            updatedMarksByUrl[url] = marks.map((m) => {
              if (m.tags?.includes(tagId)) {
                return { ...m, tags: m.tags.filter(t => t !== tagId) }
              }
              return m
            })
          })
          // 每批处理后让出执行权，避免阻塞队列中的后续操作
          if (i + BATCH_SIZE < entries.length) {
            await new Promise(resolve => setTimeout(resolve, 0))
          }
        }
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
  if (details.reason === 'install')
    browser.runtime.openOptionsPage()
})
