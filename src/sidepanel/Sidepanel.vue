<!-- src/sidepanel/Sidepanel.vue -->
<script setup lang="ts">
import { sendMessage } from 'webext-bridge/options'
import { computed, nextTick, onMounted, onUnmounted, ref, toRaw, watch, watchEffect } from 'vue'
import { CLEANUP_DAYS_THRESHOLD } from '~/logic/config'
import type { Mark } from '~/logic/storage'
import { marksByUrl, tagsMetadata, tagsReady } from '~/logic/storage'
import { usePreferredDark } from '@vueuse/core'
import TurndownService from 'turndown'
import { buildTagTree, type MarkGroup, type TagTree } from '~/logic/tagTree'

const isDark = usePreferredDark()
const turndownService = new TurndownService()
turndownService.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: (content) => `~~${content}~~`
})
watchEffect(() => {
  if (isDark.value) document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
})

const editingMarkId = ref<string | null>(null),
  editingNote = ref(''),
  currentEditingRef = ref<HTMLTextAreaElement | null>(null),
  copiedMarkId = ref<string | null>(null),
  storageUsage = ref(0),
  storageQuota = ref(0),
  storageUsagePercent = computed(() => {
    if (!storageQuota.value) return 0
    return (storageUsage.value / storageQuota.value) * 100
  }),
  expandedTexts = ref<Set<string>>(new Set()),
  expandedNotes = ref<Set<string>>(new Set()),
  activeMarkMenu = ref<string | null>(null),
  activeUrlMenu = ref<string | null>(null),
  activeGroupMenu = ref<string | null>(null),
  newTagName = ref(''),
  groupPickerUrl = ref<string | null>(null),
  groupPickerTitle = ref<string | null>(null),
  tagPickerMarkId = ref<string | null>(null)

async function createTag() {
  if (!newTagName.value.trim()) return
  await sendMessage('create-tag', { name: newTagName.value.trim() }, 'background')
  newTagName.value = ''
}

async function toggleTagForMark(mark: Mark, tagId: string) {
  const currentTags = [...(mark.tags || [])]
  const index = currentTags.indexOf(tagId)
  if (index > -1) {
    currentTags.splice(index, 1)
  } else {
    currentTags.push(tagId)
  }
  await sendMessage('update-mark-details', { id: mark.id, url: mark.url, tags: currentTags }, 'background')
}

let unregisterRefreshListener: (() => void) | null = null

const isSidepanelActive = ref(true)

onUnmounted(() => {
  isSidepanelActive.value = false
  document.removeEventListener('click', closeMenus)
  unregisterRefreshListener?.()
  if (structuredMarksDebounceTimer) clearTimeout(structuredMarksDebounceTimer)
})

onMounted(() => {
  getStorageUsage()
  document.addEventListener('click', closeMenus)
  const refreshListener = (message: any) => {
    if (message && message.type === 'refresh-sidepanel-data') {
      refreshAllMarks()
    }
  }
  browser.runtime.onMessage.addListener(refreshListener)
  unregisterRefreshListener = () => browser.runtime.onMessage.removeListener(refreshListener)
})

async function refreshAllMarks() {
  const allMarks = await sendMessage('get-all-marks', {}, 'background')
  if (allMarks) {
    // 直接替换整个响应式对象，Vue ref 会正确处理依赖更新
    marksByUrl.value = allMarks
  }
}

// --- 结构化回顾功能 ---

const collapsedFolders = ref<Record<string, boolean>>({}),
  collapsedStates = ref<Record<string, Record<string, boolean>>>({}),
  collapsedUrls = ref<Record<string, boolean>>({}),
  structuredMarks = ref<TagTree>({ inbox: { tagName: '收集箱 (Inbox)', pages: {} } })

// 使用 watch + debounce 替代 computed，避免每次 marksByUrl/tagsMetadata 微小变化都触发全量重建
let structuredMarksDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch([marksByUrl, tagsMetadata], () => {
  if (!isSidepanelActive.value) return
  if (structuredMarksDebounceTimer) clearTimeout(structuredMarksDebounceTimer)
  structuredMarksDebounceTimer = setTimeout(() => {
    if (!isSidepanelActive.value) return
    structuredMarks.value = buildTagTree(marksByUrl.value, tagsMetadata.value)
  }, 50)
}, { deep: true, immediate: true, flush: 'post' })

function toggleFolder(tagId: string) {
  collapsedFolders.value[tagId] = !isFolderCollapsed(tagId)
}

function isFolderCollapsed(tagId: string): boolean {
  return !!collapsedFolders.value[tagId]
}

function toggleUrlCollapse(url: string) {
  collapsedUrls.value[url] = !isUrlCollapsed(url)
}

function isUrlCollapsed(url: string): boolean {
  return !!collapsedUrls.value[url]
}

async function gotoChapter(selector: string, url: string) {
  const allTabs = await browser.tabs.query({ currentWindow: true })
  const targetUrl = getNormalizedUrlForTabMatching(url)

  const tab = allTabs.find((t) => {
    if (!t.url) return false
    try {
      return getNormalizedUrlForTabMatching(t.url) === targetUrl
    } catch (e) {
      return false
    }
  })

  if (tab?.id) {
    await browser.tabs.update(tab.id, { active: true })
    sendMessage('goto-chapter', { selector }, { context: 'content-script', tabId: tab.id })
  } else {
    await browser.tabs.create({ url, active: true })
  }
}

function toggleGroup(url: string, groupTitle: string, totalMarks: number) {
  if (!collapsedStates.value[url]) collapsedStates.value[url] = {}
  collapsedStates.value[url][groupTitle] = !isGroupCollapsed(url, groupTitle, totalMarks)
}

function isGroupCollapsed(url: string, groupTitle: string, totalMarks: number): boolean {
  const state = collapsedStates.value[url]?.[groupTitle]
  if (state !== undefined) return state
  return totalMarks > 15
}

function getLevelClass(level: number) {
  const levelStyles: Record<number, string> = {
    1: 'text-sm font-bold text-gray-900 dark:text-gray-100',
    2: 'text-sm font-semibold text-gray-800 dark:text-gray-200',
    3: 'text-xs font-semibold text-gray-700 dark:text-gray-300',
    4: 'text-xs font-medium text-gray-600 dark:text-gray-400',
    5: 'text-xs font-medium text-gray-600 dark:text-gray-400',
    6: 'text-xs font-medium text-gray-600 dark:text-gray-400'
  }
  return levelStyles[level] || 'text-xs font-medium text-gray-500 dark:text-gray-500'
}

function getLevelBorderStyle(level: number) {
  const styles: Record<number, object> = {
    1: { borderLeft: '4px solid #3B82F6' },
    2: { borderLeft: '3px solid #60A5FA' },
    3: { borderLeft: '2px solid #93C5FD' },
    4: { borderLeft: '1px solid #BFDBFE' },
    5: { borderLeft: '1px solid #BFDBFE' },
    6: { borderLeft: '1px solid #BFDBFE' }
  }
  return styles[level] || { borderLeft: '1px solid #BFDBFE' }
}

function toggleUrlMenu(url: string) {
  activeUrlMenu.value = activeUrlMenu.value === url ? null : url
}

function toggleTextExpansion(markId: string) {
  if (expandedTexts.value.has(markId)) expandedTexts.value.delete(markId)
  else expandedTexts.value.add(markId)
  closeMenus()
}

function toggleNoteExpansion(markId: string) {
  if (expandedNotes.value.has(markId)) expandedNotes.value.delete(markId)
  else expandedNotes.value.add(markId)
  closeMenus()
}

function toggleMarkMenu(markId: string) {
  activeMarkMenu.value = activeMarkMenu.value === markId ? null : markId
}

function closeMenus() {
  activeMarkMenu.value = null
  activeUrlMenu.value = null
  activeFolderMenu.value = null
  activeGroupMenu.value = null
}

async function removeAllMarksForUrl(url: string) {
  if (confirm(`确定要删除此页面下的所有标记吗？此操作不可撤销。`)) {
    await sendMessage('remove-marks-by-url', { url }, 'background')
    // 通知对应页面的 content script 刷新高亮（仅刷新高亮，不修改 marksByUrl 数据）
    const allTabs = await browser.tabs.query({ currentWindow: true })
    const targetUrl = getNormalizedUrlForTabMatching(url)
    const tab = allTabs.find((t) => {
      if (!t.url) return false
      try {
        return getNormalizedUrlForTabMatching(t.url) === targetUrl
      } catch (e) {
        return false
      }
    })
    if (tab?.id) {
      sendMessage('refresh-highlights', {}, { context: 'content-script', tabId: tab.id }).catch(() => {})
    }
  }
  closeMenus()
}

function openOptionsPage() {
  browser.runtime.openOptionsPage()
}

async function copyMarkText(mark: Mark) {
  try {
    await navigator.clipboard.writeText('标记：' + mark.text + '\n' + '备注：' + mark.note)
    copiedMarkId.value = mark.id
    closeMenus()
    setTimeout(() => {
      copiedMarkId.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy: ', err)
  }
}

async function editMark(mark: Mark) {
  editingMarkId.value = mark.id
  editingNote.value = mark.note
  await nextTick()
  currentEditingRef.value?.focus()
  closeMenus()
}

async function saveNote(mark: Mark) {
  if (editingMarkId.value === mark.id) {
    const rawMark = toRaw(mark)
    const payload = {
      id: rawMark.id,
      url: rawMark.url,
      note: editingNote.value
    }
    await sendMessage('update-mark-details', payload, 'background')
    editingMarkId.value = null
    editingNote.value = ''
  }
}

async function broadcastRefresh() {
  const tabs = await browser.tabs.query({ status: 'complete' })
  for (const tab of tabs) {
    if (tab.id && tab.url && tab.url.startsWith('http')) {
      sendMessage('refresh-highlights', {}, { context: 'content-script', tabId: tab.id }).catch(() => {})
    }
  }
}

function cancelEdit() {
  editingMarkId.value = null
  editingNote.value = ''
}

function setEditingRef(el: Element | null) {
  if (el instanceof HTMLTextAreaElement) {
    currentEditingRef.value = el
  } else {
    currentEditingRef.value = null
  }
}

function getHostname(url: string) {
  return new URL(url).hostname
}

function getNormalizedUrlForTabMatching(url: string | URL): string {
  const urlObj = typeof url === 'string' ? new URL(url) : url
  let path = urlObj.pathname
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return urlObj.origin + path
}

function getPageTitle(marks: Mark[]) {
  if (!marks || marks.length === 0) return '未知页面'
  return marks[0]?.title || getHostname(marks[0]?.url)
}

async function gotoMark(mark: Mark) {
  const allTabs = await browser.tabs.query({ currentWindow: true }),
    targetUrl = getNormalizedUrlForTabMatching(mark.url)
  let tab = allTabs.find((t) => {
    if (!t.url) return false
    try {
      return getNormalizedUrlForTabMatching(t.url) === targetUrl
    } catch (e) {
      return false
    }
  })
  if (tab?.id) {
    await browser.tabs.update(tab.id, { active: true })
    sendMessage('goto-mark', { markId: mark.id }, { context: 'content-script', tabId: tab.id })
  } else {
    const urlWithHash = new URL(mark.url)
    urlWithHash.hash = `__highlight-mark__${mark.id}`
    tab = await browser.tabs.create({ url: urlWithHash.href, active: true })
  }
}

async function removeMark(mark: Mark) {
  if (!confirm('确定要删除此标记吗？')) return
  const rawMark = toRaw(mark)
  const result = await sendMessage('remove-mark', rawMark, 'background')
  if (result && (result as any).success === false) {
    console.error('Failed to remove mark:', (result as any)?.error)
  }

  const allTabs = await browser.tabs.query({ currentWindow: true }),
    targetUrl = getNormalizedUrlForTabMatching(rawMark.url)
  const tab = allTabs.find((t) => {
    if (!t.url) return false
    try {
      return getNormalizedUrlForTabMatching(t.url) === targetUrl
    } catch (e) {
      return false
    }
  })
  if (tab?.id) sendMessage('remove-mark', rawMark, { context: 'content-script', tabId: tab.id })
  closeMenus()
}

async function getStorageUsage() {
  const { usage, quota } = await sendMessage('get-storage-usage', {}, 'background')
  storageUsage.value = usage
  storageQuota.value = quota
}

async function cleanupOldMarks() {
  if (confirm(`确定要清理 ${CLEANUP_DAYS_THRESHOLD} 天前的所有标记吗？此操作不可撤销。`)) {
    await sendMessage('cleanup-old-marks', { days: CLEANUP_DAYS_THRESHOLD }, 'background')
    await getStorageUsage()
    // 清理操作影响全局，通知所有 content script 刷新高亮
    const tabs = await browser.tabs.query({ status: 'complete' })
    for (const tab of tabs) {
      if (tab.id && tab.url && tab.url.startsWith('http')) {
        sendMessage('refresh-highlights', {}, { context: 'content-script', tabId: tab.id }).catch(() => {})
      }
    }
  }
}

async function cleanupUselessMarks() {
  if (confirm('确定要清理所有没有备注的标记吗？此操作不可撤销。')) {
    await sendMessage('cleanup-useless-marks', {}, 'background')
    await getStorageUsage()
    // 清理操作影响全局，通知所有 content script 刷新高亮
    const tabs = await browser.tabs.query({ status: 'complete' })
    for (const tab of tabs) {
      if (tab.id && tab.url && tab.url.startsWith('http')) {
        sendMessage('refresh-highlights', {}, { context: 'content-script', tabId: tab.id }).catch(() => {})
      }
    }
  }
}

function exportToMarkdown(urlData: { pageTitle: string; groups: MarkGroup[] }) {
  const { pageTitle, groups } = urlData
  const firstMark = groups.length > 0 && groups[0].marks.length > 0 ? groups[0].marks[0] : null
  const pageURL = firstMark?.url || ''
  let markdown = `# [${pageTitle}](${pageURL})\n\n---\n\n`
  for (const group of groups) {
    const headingLevel = Math.min(group.level + 1, 6)
    const heading = '#'.repeat(headingLevel)
    markdown += `${heading} ${group.title}\n\n`
    for (const mark of group.marks) {
      if (mark.html) {
        try {
          const contentMd = turndownService.turndown(mark.html)
          markdown += `${contentMd}\n\n`
        } catch (e) {
          markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
        }
      } else {
        markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
      }
      if (mark.note) markdown += `**备注**：${mark.note}\n\n`
      markdown += `***\n\n`
    }
  }
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeFileName = pageTitle.replace(/[/\\?%*:|"<>]/g, '-')
  a.download = `${safeFileName}.md`
  a.click()
  URL.revokeObjectURL(url)
  closeMenus()
}

// --- Tag folder more actions ---
const activeFolderMenu = ref<string | null>(null)
const editingTagId = ref<string | null>(null)
const editingTagName = ref('')
const renameDialogVisible = ref(false)
const tagPickerUrl = ref<string | null>(null)
const tagPickerVisible = ref(false)

function toggleFolderMenu(tagId: string) {
  activeFolderMenu.value = activeFolderMenu.value === tagId ? null : tagId
}

async function removeTagFromAll(tagId: string) {
  if (tagId === 'inbox') {
    alert('收集箱 (Inbox) 是默认容器，无法删除。')
    return
  }
  const tagName = tagsMetadata.value[tagId]?.name || tagId
  if (!confirm(`确定要删除标签「${tagName}」吗？标记本身不会被删除，而是移回收集箱。`)) return

  // 调用后台进行物理删除和关联清理
  // 后台已使用 enqueueWrite 序列化写操作，storage sync 会自动更新前端状态，无需全量刷新
  await sendMessage('delete-tag', { tagId }, 'background')
  activeFolderMenu.value = null
}


function openRenameDialog(tagId: string) {
  editingTagId.value = tagId
  editingTagName.value = tagsMetadata.value[tagId]?.name || ''
  renameDialogVisible.value = true
  activeFolderMenu.value = null
}

async function confirmRename() {
  if (editingTagId.value && editingTagName.value.trim()) {
    await sendMessage('rename-tag', { tagId: editingTagId.value, name: editingTagName.value.trim() }, 'background')
  }
  renameDialogVisible.value = false
  editingTagId.value = null
  editingTagName.value = ''
}

function cancelRename() {
  renameDialogVisible.value = false
  editingTagId.value = null
  editingTagName.value = ''
}

function exportTagFolder(folder: { tagName: string; pages: Record<string, any> }) {
  let markdown = `# ${folder.tagName}\n\n---\n\n`
  for (const [url, urlData] of Object.entries(folder.pages)) {
    const { pageTitle, groups } = urlData as any
    markdown += `## [${pageTitle}](${url})\n\n---\n\n`
    for (const group of groups) {
      const headingLevel = Math.min(group.level + 1, 6)
      markdown += `${'#'.repeat(headingLevel)} ${group.title}\n\n`
      for (const mark of group.marks) {
        if (mark.html) {
          try {
            markdown += `${turndownService.turndown(mark.html)}\n\n`
          } catch {
            markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
          }
        } else {
          markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
        }
        if (mark.note) markdown += `**备注**：${mark.note}\n\n`
        markdown += `***\n\n`
      }
    }
  }
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeName = folder.tagName.replace(/[/\\?%*:|"<>]/g, '-')
  a.download = `${safeName}.md`
  a.click()
  URL.revokeObjectURL(url)
  activeFolderMenu.value = null
}

function openTagPicker(url: string) {
  tagPickerUrl.value = url
  tagPickerMarkId.value = null
  tagPickerVisible.value = true
  closeMenus()
}

function closeTagPicker() {
  tagPickerUrl.value = null
  tagPickerMarkId.value = null
  tagPickerVisible.value = false
}

async function togglePageTag(tagId: string) {
  if (!tagPickerUrl.value) return
  const url = tagPickerUrl.value
  const marks = marksByUrl.value[url]
  if (!marks) return

  const updatePromises: Promise<any>[] = []

  if (tagPickerMarkId.value) {
    // 针对单个标记
    const m = marks.find((m) => m.id === tagPickerMarkId.value)
    if (!m) return
    const tags = m.tags || []
    const idx = tags.indexOf(tagId)
    const newTags = idx >= 0 ? tags.filter((t) => t !== tagId) : [...tags, tagId]
    updatePromises.push(sendMessage('update-mark-details', { id: m.id, url: m.url, tags: newTags }, 'background'))
  } else {
    // 针对整个页面
    marks.forEach((m) => {
      const tags = m.tags || []
      const idx = tags.indexOf(tagId)
      const newTags = idx >= 0 ? tags.filter((t) => t !== tagId) : [...tags, tagId]
      updatePromises.push(sendMessage('update-mark-details', { id: m.id, url: m.url, tags: newTags }, 'background'))
    })
  }
  
  if (updatePromises.length > 0) {
    await Promise.all(updatePromises)
  }
}

function isPageTagChecked(tagId: string): boolean {
  if (!tagPickerUrl.value) return false
  const marks = marksByUrl.value[tagPickerUrl.value]
  if (!marks || marks.length === 0) return false
  if (tagPickerMarkId.value) return marks.some((m) => m.id === tagPickerMarkId.value && (m.tags || []).includes(tagId))
  return marks.some((m) => (m.tags || []).includes(tagId))
}

function openMarkTagPicker(url: string, markId: string) {
  tagPickerUrl.value = url
  tagPickerMarkId.value = markId
  tagPickerVisible.value = true
  closeMenus()
}

function pageTagsSummary(url: string): string {
  const marks = marksByUrl.value[url]
  if (!marks) return ''
  const tagIds = new Set<string>()
  marks.forEach((m) => (m.tags || []).forEach((t) => tagIds.add(t)))
  const names: string[] = []
  tagIds.forEach((id) => {
    if (id === 'inbox') names.push('收集箱')
    else if (tagsMetadata.value[id]) names.push(tagsMetadata.value[id].name)
  })
  return names.join(', ')
}

// --- Group-level actions ---
function toggleGroupMenu(url: string, title: string) {
  const key = `${url}|${title}`
  activeGroupMenu.value = activeGroupMenu.value === key ? null : key
}

async function removeGroupMarks(url: string, group: any) {
  if (!confirm(`确定要删除分组「${group.title}」下的所有标记吗？`)) return
  await sendMessage('remove-marks', { marks: group.marks.map(toRaw) }, 'background')

  // 同步通知 content script 移除页面高亮
  const allTabs = await browser.tabs.query({ currentWindow: true })
  const targetUrl = getNormalizedUrlForTabMatching(url)
  const tab = allTabs.find((t) => {
    if (!t.url) return false
    try {
      return getNormalizedUrlForTabMatching(t.url) === targetUrl
    } catch (e) {
      return false
    }
  })
  if (tab?.id) {
    await Promise.all(
      group.marks.map((m: Mark) =>
        sendMessage('remove-mark', toRaw(m), { context: 'content-script', tabId: tab.id }).catch(() => {})
      )
    )
  }

  activeGroupMenu.value = null
}

function exportGroup(url: string, group: any) {
  let md = `# ${group.title}\n\n---\n\n`
  for (const mark of group.marks) {
    if (mark.html) {
      try {
        md += `${turndownService.turndown(mark.html)}\n\n`
      } catch {
        md += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
      }
    } else {
      md += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
    }
    if (mark.note) md += `**备注**：${mark.note}\n\n`
    md += `***\n\n`
  }
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const urlObj = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = urlObj
  const safe = group.title.replace(/[/\\?%*:|"<>]/g, '-')
  a.download = `${safe}.md`
  a.click()
  URL.revokeObjectURL(urlObj)
  activeGroupMenu.value = null
}

function openGroupTagPicker(url: string, title: string) {
  groupPickerUrl.value = url
  groupPickerTitle.value = title
  tagPickerUrl.value = url
  tagPickerVisible.value = true
  activeGroupMenu.value = null
}
</script>

<template>
  <main
    class="min-h-screen bg-gray-100 dark:bg-gray-900 p-[16px] pb-[144px] font-sans relative text-gray-800 dark:text-gray-200"
  >
    <button
      class="absolute top-[16px] right-[16px] p-[8px] text-gray-500 hover:text-gray-800"
      title="打开设置"
      @click="openOptionsPage"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-[24px] w-[24px]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>

    <h1 class="text-xl font-bold text-center text-gray-800 dark:text-gray-200 mt-4 mb-2">标记管理</h1>

    <!-- 标签创建 UI -->
    <div class="px-2 mb-6">
      <div
        class="flex gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"
      >
        <input
          v-model="newTagName"
          placeholder="新建标签..."
          class="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          @keydown.enter="createTag"
        />
        <button
          class="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          @click="createTag"
        >
          创建
        </button>
      </div>
    </div>

    <div class="space-y-6">
      <div
        v-if="Object.keys(marksByUrl).length === 0 && Object.keys(tagsMetadata).length === 0"
        class="flex flex-col items-center justify-center text-gray-500 pt-[40px] rounded-lg bg-white dark:bg-gray-800 p-[24px] shadow-md"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-[64px] h-[64px] text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
          />
        </svg>
        <p class="mt-[16px]">还没有任何标记</p>
        <p class="text-[14px] text-gray-400">在网页上按住ALT，然后选中文本试试看</p>
      </div>
      <div v-else>
        <!-- 顶级文件夹层 (Tags / Inbox) -->
        <div v-for="[tagId, folder] in Object.entries(structuredMarks)" :key="tagId" class="mb-6 shadow-sm">
          <div
            class="flex items-center gap-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-t-lg cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-700 border-b-0"
            :class="{ 'rounded-b-lg': isFolderCollapsed(tagId) }"
            @click="toggleFolder(tagId)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-gray-500 transition-transform duration-200"
              :class="{ 'rotate-[-90deg]': isFolderCollapsed(tagId) }"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="font-bold text-gray-700 dark:text-gray-200 flex-1">{{ folder.tagName }}</span>
            <span class="text-xs text-gray-400 mr-2">{{ Object.keys(folder.pages).length }}</span>
            <div class="relative flex-shrink-0" @click.stop>
              <button
                class="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded-full"
                @click="toggleFolderMenu(tagId)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
                  />
                </svg>
              </button>
              <transition name="fade-scale">
                <div
                  v-if="activeFolderMenu === tagId"
                  class="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-700 rounded-md shadow-lg z-20 border border-gray-200 dark:border-gray-600"
                >
                  <ul class="py-1">
                    <li>
                      <button
                        class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                        @click="exportTagFolder(folder)"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        <span>导出</span>
                      </button>
                    </li>
                    <li>
                      <button
                        class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                        @click="openRenameDialog(tagId)"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        <span>重命名</span>
                      </button>
                    </li>
                    <li v-if="tagId !== 'inbox'">
                      <button
                        class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"
                        @click="removeTagFromAll(tagId)"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fill-rule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        <span>删除标签</span>
                      </button>
                    </li>
                  </ul>
                </div>
              </transition>
            </div>
          </div>

          <div
            v-if="!isFolderCollapsed(tagId)"
            class="space-y-4 p-2 border-x border-b border-gray-200 dark:border-gray-700 rounded-b-lg bg-gray-50 dark:bg-gray-800"
          >
            <div
              v-if="Object.keys(folder.pages).length === 0"
              class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm"
            >
              暂无标记
            </div>
            <section
              v-for="[url, urlData] in Object.entries(folder.pages)"
              :key="url"
              class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-[12px] border border-gray-100 dark:border-gray-700"
            >
              <header
                class="flex justify-between items-center pb-[8px] mb-[8px] border-b border-gray-200 dark:border-gray-700 cursor-pointer group/page"
                @click="toggleUrlCollapse(url)"
              >
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-[14px] w-[14px] flex-shrink-0 text-gray-400 group-hover/page:text-gray-600 transition-transform duration-200"
                    :class="{ 'rotate-[-90deg]': isUrlCollapsed(url) }"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate" :title="url">
                    {{ urlData.pageTitle }}
                  </h2>
                </div>
                <div class="relative flex-shrink-0" @click.stop>
                  <button
                    class="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded-full"
                    @click="toggleUrlMenu(url)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
                      />
                    </svg>
                  </button>
                  <transition name="fade-scale">
                    <div
                      v-if="activeUrlMenu === url"
                      class="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-700 rounded-md shadow-lg z-20 border border-gray-200 dark:border-gray-600"
                    >
                      <ul class="py-1">
                        <li>
                          <button
                            class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                            @click="exportToMarkdown(urlData)"
                          >
                            <span>导出</span>
                          </button>
                        </li>
                        <li>
                          <button
                            class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                            @click="openTagPicker(url)"
                          >
                            <span>管理标签</span>
                          </button>
                        </li>
                        <li>
                          <button
                            class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"
                            @click="removeAllMarksForUrl(url)"
                          >
                            <span>清空标记</span>
                          </button>
                        </li>
                      </ul>
                    </div>
                  </transition>
                </div>
              </header>
              <div v-if="!isUrlCollapsed(url)">
                <div v-for="group in urlData.groups" :key="group.title" class="group group-container mt-1">
                  <header
                    class="group-header flex justify-between items-center py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 -mx-2 px-2 transition-colors"
                    :style="getLevelBorderStyle(group.level)"
                    @click="toggleGroup(url, group.title, urlData.totalMarks)"
                  >
                    <h3 class="flex-1 min-w-0 truncate" :class="getLevelClass(group.level)">
                      {{ group.title }}
                      <span class="font-normal text-gray-400 text-xs">({{ group.count }})</span>
                    </h3>
                    <div class="relative flex-shrink-0 ml-2" @click.stop>
                      <button
                        class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="分组操作"
                        @click="toggleGroupMenu(url, group.title)"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
                          />
                        </svg>
                      </button>
                      <transition name="fade-scale">
                        <div
                          v-if="activeGroupMenu === `${url}|${group.title}`"
                          class="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-700 rounded-md shadow-lg z-20 border border-gray-200 dark:border-gray-600"
                        >
                          <ul class="py-1">
                            <li>
                              <button
                                class="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                @click="exportGroup(url, group)"
                              >
                                <span>导出</span>
                              </button>
                            </li>
                            <li>
                              <button
                                class="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                @click="openGroupTagPicker(url, group.title)"
                              >
                                <span>管理标签</span>
                              </button>
                            </li>
                            <li>
                              <button
                                class="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"
                                @click="removeGroupMarks(url, group)"
                              >
                                <span>删除标记</span>
                              </button>
                            </li>
                          </ul>
                        </div>
                      </transition>
                    </div>
                  </header>

                  <ul v-if="!isGroupCollapsed(url, group.title, urlData.totalMarks)" class="space-y-3 pt-2 pl-3">
                    <li v-for="mark in group.marks" :key="mark.id" class="group flex items-start gap-2 relative">
                      <div
                        class="color-indicator w-1 h-[20px] rounded-full flex-shrink-0"
                        :style="{ backgroundColor: mark.color }"
                      ></div>
                      <div class="flex-1 min-w-0">
                        <div class="cursor-pointer" @click="gotoMark(mark)">
                          <div
                            class="rich-text-content text-sm font-medium max-w-none text-gray-800 dark:text-gray-200 overflow-hidden transition-all duration-300 ease-in-out"
                            :class="expandedTexts.has(mark.id) ? 'max-h-96' : 'max-h-5'"
                            v-html="mark.html || mark.text"
                          ></div>
                        </div>
                        <div v-if="editingMarkId === mark.id" class="mt-2">
                          <textarea
                            v-model="editingNote"
                            :ref="setEditingRef"
                            class="w-full border-gray-300 rounded-md p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                            @keydown.enter.prevent="saveNote(mark)"
                            @keydown.esc="cancelEdit"
                          ></textarea>
                          <div class="flex justify-end gap-2 mt-2">
                            <button
                              class="action-button rounded-md bg-gray-200 px-3 py-1 text-sm font-medium text-gray-800 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                              @click.stop="cancelEdit"
                            >
                              取消
                            </button>
                            <button
                              class="action-button rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                              @click.stop="saveNote(mark)"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                        <p
                          v-else
                          :title="mark.note"
                          class="text-xs text-gray-500 mt-1 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 cursor-pointer overflow-hidden transition-all duration-300 ease-in-out"
                          :class="expandedNotes.has(mark.id) ? 'max-h-96' : 'max-h-5'"
                          @click.stop="editMark(mark)"
                        >
                          {{ mark.note || '点击添加备注...' }}
                        </p>
                      </div>
                      <div class="relative flex-shrink-0">
                        <button
                          class="p-1 text-gray-400 hover:text-gray-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          title="更多操作"
                          @click.stop="toggleMarkMenu(mark.id)"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
                            />
                          </svg>
                        </button>

                        <transition name="fade-scale">
                          <div
                            v-if="activeMarkMenu === mark.id"
                            class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-30 border border-gray-200 dark:border-gray-600"
                            @click.stop
                          >
                            <div class="py-1">
                              <button
                                class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                @click="toggleTextExpansion(mark.id)"
                              >
                                <span>{{ expandedTexts.has(mark.id) ? '收起标记' : '展开标记' }}</span>
                              </button>
                              <button
                                v-if="mark.note"
                                class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                @click="toggleNoteExpansion(mark.id)"
                              >
                                <span>{{ expandedNotes.has(mark.id) ? '收起备注' : '展开备注' }}</span>
                              </button>
                              <div class="my-1 border-t border-gray-100 dark:border-gray-600"></div>
                              <button
                                class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                                @click="openMarkTagPicker(url, mark.id)"
                              >
                                管理标签
                              </button>

                              <button
                                class="w-full text-left text-sm px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                @click="copyMarkText(mark)"
                              >
                               
                                <span>复制标记</span>
                              </button>
                              <button
                                class="w-full text-left text-sm px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50"
                                @click="removeMark(mark)"
                              >
                                删除标记
                              </button>
                            </div>
                          </div>
                        </transition>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>

    <div
      class="fixed bottom-0 left-0 right-0 z-10 w-full border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 p-[16px] shadow-lg backdrop-blur-sm"
    >
      <h2 class="text-[18px] font-semibold text-gray-700 dark:text-gray-200 mb-[8px]">存储管理</h2>
      <div class="text-[14px] text-gray-600 dark:text-gray-400">
        <p>
          已用空间: {{ (storageUsage / 1024).toFixed(2) }} KB /
          <span v-if="storageQuota">{{ (storageQuota / 1024 / 1024).toFixed(2) }} MB</span>
          <span v-else>无已知限制</span>
        </p>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-[10px] mt-[4px]">
          <div class="bg-blue-600 h-[10px] rounded-full" :style="{ width: `${storageUsagePercent}%` }"></div>
        </div>
      </div>
      <div class="mt-[16px] flex gap-[8px]">
        <button
          class="action-button rounded-md bg-red-100 px-[12px] py-[4px] text-[14px] font-medium text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900"
          @click="cleanupOldMarks"
        >
          清理 {{ CLEANUP_DAYS_THRESHOLD }} 天前的标记
        </button>
        <button
          class="action-button rounded-md bg-yellow-100 px-[12px] py-[4px] text-[14px] font-medium text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-400 dark:hover:bg-yellow-900"
          @click="cleanupUselessMarks"
        >
          清理无备注的标记
        </button>
      </div>
    </div>

    <!-- Tag Picker Dialog -->
    <div
      v-if="tagPickerVisible"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="closeTagPicker"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5 w-80 max-w-full mx-4">
        <h3 class="text-base font-semibold mb-3 text-gray-800 dark:text-gray-200">标签</h3>
        <p class="text-xs text-gray-500 mb-3 truncate">
          {{ tagPickerUrl ? (tagPickerMarkId ? '单个标记' : getHostname(tagPickerUrl)) : '' }}
        </p>
        <div class="space-y-2 max-h-60 overflow-y-auto">
          <label class="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
            <input
              type="checkbox"
              :checked="isPageTagChecked('inbox')"
              @change="togglePageTag('inbox')"
              class="h-4 w-4"
            />
            <span class="text-sm text-gray-700 dark:text-gray-200">收集箱 (Inbox)</span>
          </label>
          <label
            v-for="tag in Object.values(tagsMetadata)"
            :key="tag.id"
            class="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="isPageTagChecked(tag.id)"
              @change="togglePageTag(tag.id)"
              class="h-4 w-4"
            />
            <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: tag.color }"></span>
            <span class="text-sm text-gray-700 dark:text-gray-200">{{ tag.name }}</span>
          </label>
        </div>
        <div class="flex justify-end mt-4">
          <button
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            @click="closeTagPicker"
          >
            完成
          </button>
        </div>
      </div>
    </div>

    <!-- Rename Tag Dialog -->
    <div
      v-if="renameDialogVisible"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="cancelRename"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5 w-72 max-w-full mx-4">
        <h3 class="text-base font-semibold mb-3 text-gray-800 dark:text-gray-200">重命名标签</h3>
        <input
          v-model="editingTagName"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="输入新标签名称"
          @keydown.enter.prevent="confirmRename"
          @keydown.esc="cancelRename"
        />
        <div class="flex justify-end gap-2 mt-4">
          <button
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
            @click="cancelRename"
          >
            取消
          </button>
          <button
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            @click="confirmRename"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
<style>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
  transform-origin: top right;
}
.rich-text-content :where(p, ul, ol, pre, blockquote) {
  margin-top: 0;
  margin-bottom: 0;
}
.rich-text-content > *:not(:first-child) {
  margin-top: 0.5rem;
}
.rich-text-content :where(ul, ol) {
  padding-left: 1.25rem;
}
.rich-text-content :where(code):not(pre *) {
  font-size: 0.875em;
  background-color: #f3f4f6;
  color: #111827;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-weight: 400;
}
.dark .rich-text-content :where(code):not(pre *) {
  background-color: #374151;
  color: #f9fafb;
}
.rich-text-content :where(pre) {
  background-color: #f3f4f6;
  padding: 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  font-size: 0.875em;
}
.dark .rich-text-content :where(pre) {
  background-color: #1f2937;
}
.rich-text-content :where(pre code) {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  color: inherit;
  font-weight: inherit;
}
.rich-text-content :where(strong, b) {
  font-weight: 600;
}
.rich-text-content :where(em, i) {
  font-style: italic;
}
</style>
