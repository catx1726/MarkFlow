<!-- src/sidepanel/Sidepanel.vue -->
<script setup lang="ts">
import { sendMessage } from 'webext-bridge/popup'
import { computed, nextTick, onMounted, onUnmounted, ref, toRaw, watchEffect } from 'vue'
import { CLEANUP_DAYS_THRESHOLD } from '~/logic/config'
import type { Mark } from '~/logic/storage'
import { marksByUrl } from '~/logic/storage'
import { usePreferredDark } from '@vueuse/core'
const isDark = usePreferredDark()
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
  activeUrlMenu = ref<string | null>(null)

onUnmounted(() => {
  document.removeEventListener('click', closeMenus)
})

onMounted(() => {
  getStorageUsage()
  document.addEventListener('click', closeMenus)
})

// --- 结构化回顾功能 ---

interface MarkGroup {
  title: string
  level: number
  selector: string
  marks: Mark[]
  count: number
  order: number // 分组的排序依据
}

// State for collapsing groups and URLs
const collapsedStates = ref<Record<string, Record<string, boolean>>>({}),
  collapsedUrls = ref<Record<string, boolean>>({}),
  structuredMarks = computed(() => {
    const result: Record<string, { pageTitle: string; groups: MarkGroup[]; totalMarks: number }> = {}
    for (const [url, marks] of Object.entries(marksByUrl.value)) {
      if (!marks || marks.length === 0) continue

      const pageTitle = getPageTitle(marks)
      const groups: Record<string, MarkGroup> = {}

      for (const mark of marks) {
        const contextTitle = mark.contextTitle || '未分类笔记',
          contextLevel = mark.contextLevel || 7,
          contextSelector = mark.contextSelector || 'body',
          contextOrder = mark.contextOrder ?? -1 // 获取顺序，默认为-1,

        if (!groups[contextTitle]) {
          groups[contextTitle] = {
            title: contextTitle,
            level: contextLevel,
            selector: contextSelector,
            marks: [],
            count: 0,
            order: contextOrder
          }
        }
        groups[contextTitle].marks.push(mark)
      }

      // 按创建时间排序每个分组内的笔记
      for (const group of Object.values(groups)) {
        group.marks.sort((a, b) => a.createdAt - b.createdAt)
        group.count = group.marks.length
      }

      // 按分组在文档中出现的物理顺序排序
      const sortedGroups = Object.values(groups).sort((a, b) => a.order - b.order)

      result[url] = { pageTitle, groups: sortedGroups, totalMarks: marks.length }
    }
    return result
  })

function toggleUrlCollapse(url: string) {
  collapsedUrls.value[url] = !isUrlCollapsed(url)
}

function isUrlCollapsed(url: string): boolean {
  // 默认不折叠
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
    1: 'text-base font-bold text-gray-900 dark:text-gray-100',
    2: 'text-base font-semibold text-gray-800 dark:text-gray-200',
    3: 'text-sm font-semibold text-gray-700 dark:text-gray-300',
    4: 'text-sm font-medium text-gray-600 dark:text-gray-400',
    5: 'text-sm font-medium text-gray-600 dark:text-gray-400',
    6: 'text-sm font-medium text-gray-600 dark:text-gray-400'
  }
  // 为“未分类笔记”提供默认样式
  return levelStyles[level] || 'text-sm font-medium text-gray-500 dark:text-gray-500'
}

function getLevelBorderStyle(level: number) {
  const styles: Record<number, object> = {
    1: { borderLeft: '6px solid #000000' },
    2: { borderLeft: '4px solid #000000' },
    3: { borderLeft: '2px solid #000000' },
    4: { borderLeft: '1px solid #000000' },
    5: { borderLeft: '1px solid #000000' },
    6: { borderLeft: '1px solid #000000' }
  }
  // 为“未分类笔记”提供默认样式
  return styles[level] || { borderLeft: '1px solid #000000' }
}

// --- End of 结构化回顾功能 ---

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
}

async function removeAllMarksForUrl(url: string) {
  if (confirm(`确定要删除此页面下的所有标记吗？此操作不可撤销。`)) {
    await sendMessage('remove-marks-by-url', { url }, 'background')
    // 删除后，广播刷新以更新所有内容脚本
    await broadcastRefresh()
  }

  closeMenus()
}

function openOptionsPage() {
  browser.runtime.openOptionsPage()
}

async function copyMarkText(mark: Mark) {
  try {
    await navigator.clipboard.writeText('引文：' + mark.text + '\n' + '备注：' + mark.note)
    copiedMarkId.value = mark.id

    closeMenus() // 复制后关闭菜单

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
}

async function saveNote(mark: Mark) {
  if (editingMarkId.value === mark.id) {
    await sendMessage('update-mark-details', { id: mark.id, url: mark.url, note: editingNote.value }, 'background')
    editingMarkId.value = null
    editingNote.value = ''
  }
}

async function broadcastRefresh() {
  const tabs = await browser.tabs.query({ status: 'complete' })
  for (const tab of tabs) {
    // 只向有权限访问的 http/https 页面发送消息
    if (tab.id && tab.url && tab.url.startsWith('http')) {
      sendMessage('refresh-highlights', {}, { context: 'content-script', tabId: tab.id }).catch(() => {
        /* content script 可能未注入，忽略错误 */
      })
    }
  }
}

function cancelEdit() {
  editingMarkId.value = null
  editingNote.value = ''
}

function setEditingRef(el: Element | null) {
  // 只有当元素存在且是 textarea 时，才赋值给 currentEditingRef
  if (el instanceof HTMLTextAreaElement) {
    currentEditingRef.value = el
  } else {
    // 清除引用
    currentEditingRef.value = null
  }
}

function getHostname(url: string) {
  return new URL(url).hostname
}

function getNormalizedUrlForTabMatching(url: string | URL): string {
  const urlObj = typeof url === 'string' ? new URL(url) : url
  let path = urlObj.pathname
  // 移除路径末尾的斜杠（根路径 / 除外）
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)

  return urlObj.origin + path
}

function getPageTitle(marks: Mark[]) {
  if (!marks || marks.length === 0) return '未知页面'

  // 默认使用第一个标记的标题作为页面标题
  return marks[0]?.title || getHostname(marks[0]?.url)
}

async function gotoMark(mark: Mark) {
  // A more robust way to find the tab, ignoring query parameters and hash
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
    // 如果找到了，激活它并发送消息
    await browser.tabs.update(tab.id, { active: true })
    sendMessage('goto-mark', { markId: mark.id }, { context: 'content-script', tabId: tab.id })
  } else {
    // 如果找不到，新建一个 Tab 并用 hash 传递要跳转的标记 ID
    const urlWithHash = new URL(mark.url)

    urlWithHash.hash = `__highlight-mark__${mark.id}`

    tab = await browser.tabs.create({ url: urlWithHash.href, active: true })
  }

  if (!tab?.id) {
    console.error('无法创建或找到 Tab。')
    return
  }
}

async function removeMark(mark: Mark) {
  // 核心修正：在发送之前，将 mark 转换为纯 JavaScript 对象
  const rawMark = toRaw(mark)

  // 1. 发送给 Background Script
  await sendMessage('remove-mark', rawMark, 'background')

  // Also use the robust tab finding logic for removing marks from the page
  const allTabs = await browser.tabs.query({ currentWindow: true }),
    targetUrl = getNormalizedUrlForTabMatching(rawMark.url) // Use rawMark.url for safety

  const tab = allTabs.find((t) => {
    if (!t.url) return false
    try {
      return getNormalizedUrlForTabMatching(t.url) === targetUrl
    } catch (e) {
      return false
    }
  })

  // 2. 发送给 Content Script
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
    // 清理之后需要再次更新页面标记
    await broadcastRefresh()
  }
}

async function cleanupUselessMarks() {
  if (confirm('确定要清理所有没有备注的标记吗？此操作不可撤销。')) {
    await sendMessage('cleanup-useless-marks', {}, 'background')
    await getStorageUsage()
    // 清理之后需要再次更新页面标记
    await broadcastRefresh()
  }
}

function exportToMarkdown(urlData: { pageTitle: string; groups: MarkGroup[] }) {
  const { pageTitle, groups } = urlData
  // Get URL from the first mark available
  const firstMark = groups.length > 0 && groups[0].marks.length > 0 ? groups[0].marks[0] : null
  const pageURL = firstMark?.url || ''

  let markdown = `# [${pageTitle}](${pageURL})\n\n---\n\n`

  for (const group of groups) {
    // Use heading level based on contextLevel. H1 -> ##, H2 -> ###, etc.
    const headingLevel = Math.min(group.level + 1, 6) // Cap at H6
    const heading = '#'.repeat(headingLevel)
    markdown += `${heading} ${group.title}\n\n`

    for (const mark of group.marks) {
      markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
      if (mark.note) markdown += `${mark.note}\n\n`
      markdown += `---\n\n` // Use a more subtle separator within a chapter
    }
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // 移除文件名中的非法字符
  const safeFileName = pageTitle.replace(/[/\\?%*:|"<>]/g, '-')
  a.download = `${safeFileName}.md`
  a.click()
  URL.revokeObjectURL(url)

  closeMenus()
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
    <h1 class="text-xl font-bold text-center text-gray-800 dark:text-gray-200 my-4">标记管理</h1>
    <div class="space-y-6">
      <div
        v-if="Object.keys(marksByUrl).length === 0"
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
        <section
          v-for="[url, urlData] in Object.entries(structuredMarks)"
          :key="url"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-[16px] mb-[16px]"
        >
          <header
            class="flex justify-between items-center pb-[8px] mb-[8px] border-b border-gray-200 dark:border-gray-700 cursor-pointer group/page"
            @click="toggleUrlCollapse(url)"
          >
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-[16px] w-[16px] flex-shrink-0 text-gray-400 group-hover/page:text-gray-600 transition-transform duration-200"
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
              <h2 class="text-base font-semibold text-gray-700 dark:text-gray-300 truncate" :title="url">
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
                      class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"
                      @click="removeAllMarksForUrl(url)"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span>清空</span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </header>
          <div v-if="!isUrlCollapsed(url)">
            <div v-for="group in urlData.groups" :key="group.title" class="group-container mt-1">
              <header
                class="group-header flex justify-between items-center py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 -mx-2 px-2 transition-colors"
                :style="getLevelBorderStyle(group.level)"
                @click="toggleGroup(url, group.title, urlData.totalMarks)"
              >
                <h3 class="flex-1 min-w-0 truncate" :class="getLevelClass(group.level)">
                  {{ group.title }}
                  <span class="font-normal text-gray-400 text-sm">({{ group.count }})</span>
                </h3>
              </header>

              <ul v-if="!isGroupCollapsed(url, group.title, urlData.totalMarks)" class="space-y-3 pt-2 pl-3">
                <li v-for="mark in group.marks" :key="mark.id" class="group flex items-start gap-2 relative">
                  <div
                    class="color-indicator w-1 h-[20px] rounded-full flex-shrink-0"
                    :style="{ backgroundColor: mark.color }"
                  ></div>
                  <div class="flex-1 min-w-0">
                    <div class="cursor-pointer" @click="gotoMark(mark)">
                      <p
                        class="text-sm font-medium text-gray-800 dark:text-gray-200 overflow-hidden transition-all duration-300 ease-in-out"
                        :class="expandedTexts.has(mark.id) ? 'max-h-96' : 'max-h-5'"
                        :title="mark.text"
                      >
                        {{ mark.text }}
                      </p>
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
                      class="text-sm text-gray-500 mt-1 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 cursor-pointer overflow-hidden transition-all duration-300 ease-in-out"
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
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
                        />
                      </svg>
                    </button>
                    <transition name="fade-scale">
                      <div
                        v-if="activeMarkMenu === mark.id"
                        class="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-600"
                        @click.stop
                      >
                        <ul class="py-1 text-sm">
                          <li>
                            <button
                              class="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                              @click="toggleTextExpansion(mark.id)"
                            >
                              <span>{{ expandedTexts.has(mark.id) ? '收起引文' : '展开引文' }}</span>
                            </button>
                          </li>
                          <li v-if="mark.note">
                            <button
                              class="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                              @click="toggleNoteExpansion(mark.id)"
                            >
                              <span>{{ expandedNotes.has(mark.id) ? '收起备注' : '展开备注' }}</span>
                            </button>
                          </li>
                          <div class="my-1 border-t border-gray-100"></div>
                          <li>
                            <button
                              class="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                              @click="copyMarkText(mark)"
                            >
                              <svg
                                v-if="copiedMarkId === mark.id"
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-4 h-4 text-green-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                              <svg
                                v-else
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-4 h-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                                <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h6a2 2 0 00-2-2H5z" />
                              </svg>
                              <span>复制</span>
                            </button>
                          </li>
                          <li>
                            <button
                              class="w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"
                              @click="removeMark(mark)"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-4 h-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                              <span>删除</span>
                            </button>
                          </li>
                        </ul>
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
  </main>
</template>
<style>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
  transform-origin: top right;
}

.slide-fade-enter-active {
  transition: all 0.2s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
  max-height: 0;
}
</style>
