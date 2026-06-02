<script setup lang="ts">
import { onMounted, onUnmounted, toRaw, watchEffect } from 'vue'
import { usePreferredDark } from '@vueuse/core'
import { sendMessage } from 'webext-bridge/options'
import browser from 'webextension-polyfill'

// Logic
import { useSidepanelData } from './composables/useSidepanelData'
import { useUIState } from './composables/useUIState'
import { useTagActions } from './composables/useTagActions'
import { useMarkActions } from './composables/useMarkActions'
import { useStorageMonitor } from './composables/useStorageMonitor'

// Components
import SidepanelHeader from './components/SidepanelHeader.vue'
import TagFolder from './components/TagFolder.vue'
import StorageManager from './components/StorageManager.vue'
import { marksByUrl, tagsMetadata } from '~/logic/storage'

// --- Setup ---
const isDark = usePreferredDark()
watchEffect(() => {
  if (isDark.value)
    document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
})

// --- Logic Composables ---
const { structuredMarks } = useSidepanelData()
const {
  collapsedStates,
  collapsedUrls,
  expandedTexts,
  expandedNotes,
  activeMarkMenu,
  activeUrlMenu,
  activeFolderMenu,
  activeGroupMenu,
  editingMarkId,
  toggleUrlCollapse,
  closeMenus,
} = useUIState()

const {
  newTagName,
  tagPickerUrl,
  editingTagId: _editingTagId,
  editingTagName,
  renameDialogVisible,
  createTag,
  togglePageTag,
  isPageTagChecked,
  openTagPicker,
  openRenameDialog,
  confirmRename,
  cancelRename,
  deleteTag,
} = useTagActions()

const {
  gotoMark,
  removeMark,
  saveNote,
  copyMarkText,
  exportToMarkdown,
  exportTagFolder,
} = useMarkActions()

const {
  storageUsage,
  storageQuota,
  storageUsagePercent,
  refreshUsage,
  cleanupOldMarks,
  cleanupUselessMarks,
} = useStorageMonitor()

// --- Event Handlers ---
async function refreshAllMarks() {
  const allMarks = await sendMessage('get-all-marks', {}, 'background')
  if (allMarks)
    marksByUrl.value = allMarks
}

async function removeAllMarksForUrl(url: string) {
  // eslint-disable-next-line no-alert
  if (confirm(`确定要删除此页面下的所有标记吗？此操作不可撤销。`)) {
    await sendMessage('remove-marks-by-url', { url }, 'background')
    broadcastRefreshToTabs()
  }
  closeMenus()
}

async function removeGroupMarks(url: string, group: any) {
  // eslint-disable-next-line no-alert
  if (!confirm(`确定要删除分组「${group.title}」下的所有标记吗？`))
    return
  await sendMessage('remove-marks', { marks: group.marks.map(toRaw) }, 'background')
  broadcastRefreshToTabs()
  closeMenus()
}

async function broadcastRefreshToTabs() {
  const tabs = await browser.tabs.query({ status: 'complete' })
  for (const tab of tabs) {
    if (tab.id && tab.url && tab.url.startsWith('http')) {
      sendMessage('refresh-highlights', {}, { context: 'content-script', tabId: tab.id }).catch(() => {})
    }
  }
}

let unregisterRefreshListener: (() => void) | null = null

onMounted(() => {
  refreshUsage()
  document.addEventListener('click', closeMenus)
  const refreshListener = (message: any) => {
    if (message && message.type === 'refresh-sidepanel-data')
      refreshAllMarks()
  }
  browser.runtime.onMessage.addListener(refreshListener)
  unregisterRefreshListener = () => browser.runtime.onMessage.removeListener(refreshListener)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenus)
  unregisterRefreshListener?.()
})

function toggleGroup(url: string, groupTitle: string, totalMarks: number) {
  if (!collapsedStates.value[url])
    collapsedStates.value[url] = {}
  collapsedStates.value[url][groupTitle] = !isGroupCollapsed(url, groupTitle, totalMarks)
}

function isGroupCollapsed(url: string, groupTitle: string, totalMarks: number): boolean {
  const state = collapsedStates.value[url]?.[groupTitle]
  return state !== undefined ? state : totalMarks > 15
}

function handleOpenOptions() {
  browser.runtime.openOptionsPage()
}

function handleToggleMarkMenu(markId: string) {
  activeMarkMenu.value = activeMarkMenu.value === markId ? null : markId
}

function handleToggleUrlMenu(url: string) {
  activeUrlMenu.value = activeUrlMenu.value === url ? null : url
}

function handleToggleFolderMenu(tagId: string) {
  activeFolderMenu.value = activeFolderMenu.value === tagId ? null : tagId
}

function handleToggleGroupMenu(url: string, title: string) {
  const key = `${url}|${title}`
  activeGroupMenu.value = activeGroupMenu.value === key ? null : key
}

function handleToggleTextExpansion(markId: string) {
  if (expandedTexts.value.has(markId))
    expandedTexts.value.delete(markId)
  else expandedTexts.value.add(markId)
  closeMenus()
}

function handleToggleNoteExpansion(markId: string) {
  if (expandedNotes.value.has(markId))
    expandedNotes.value.delete(markId)
  else expandedNotes.value.add(markId)
  closeMenus()
}

async function handleDeleteTag(tagId: string) {
  if (tagId === 'inbox') {
    // eslint-disable-next-line no-alert
    alert('收集箱 (Inbox) 是默认容器，无法删除。')
    return
  }
  const tagName = tagsMetadata.value[tagId]?.name || tagId
  // eslint-disable-next-line no-alert
  if (!confirm(`确定要删除标签「${tagName}」吗？标记本身不会被删除，而是移回收集箱。`))
    return
  await deleteTag(tagId)
  activeFolderMenu.value = null
}
</script>

<template>
  <main
    class="min-h-screen bg-gray-100 dark:bg-gray-900 p-[16px] pb-[144px] font-sans relative text-gray-800 dark:text-gray-200"
  >
    <SidepanelHeader
      v-model:new-tag-name="newTagName"
      @create-tag="createTag"
      @open-options="handleOpenOptions"
    />

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
        <p class="mt-[16px]">
          还没有任何标记
        </p>
        <p class="text-[14px] text-gray-400">
          在网页上按住ALT，然后选中文本试试看
        </p>
      </div>
      <div v-else>
        <TagFolder
          v-for="[tagId, folder] in Object.entries(structuredMarks)"
          :key="tagId"
          :tag-id="tagId"
          :folder="folder"
          :is-open="tagId === 'inbox'"
          :collapsed-urls="collapsedUrls"
          :collapsed-states="collapsedStates"
          :expanded-texts="expandedTexts"
          :expanded-notes="expandedNotes"
          :editing-mark-id="editingMarkId"
          :active-mark-menu="activeMarkMenu"
          :active-url-menu="activeUrlMenu"
          :active-folder-menu="activeFolderMenu"
          :active-group-menu="activeGroupMenu"
          @toggle-folder-menu="handleToggleFolderMenu"
          @export-tag-folder="exportTagFolder"
          @open-rename-dialog="openRenameDialog"
          @remove-tag-from-all="handleDeleteTag"
          @toggle-url-collapse="toggleUrlCollapse"
          @toggle-url-menu="handleToggleUrlMenu"
          @export-markdown="exportToMarkdown"
          @open-tag-picker="u => openTagPicker(u)"
          @remove-all-marks="removeAllMarksForUrl"
          @toggle-group="toggleGroup"
          @toggle-group-menu="handleToggleGroupMenu"
          @export-group="exportGroup"
          @open-group-tag-picker="(u, _t) => openTagPicker(u)"
          @remove-group-marks="removeGroupMarks"
          @goto-mark="gotoMark"
          @edit-mark="m => { editingMarkId = m.id }"
          @save-note="(m, note) => { saveNote(m.id, m.url, note); editingMarkId = null }"
          @cancel-edit="editingMarkId = null"
          @remove-mark="removeMark"
          @copy-mark="copyMarkText"
          @toggle-text-expansion="handleToggleTextExpansion"
          @toggle-note-expansion="handleToggleNoteExpansion"
          @toggle-mark-menu="handleToggleMarkMenu"
          @open-mark-tag-picker="(u, id) => openTagPicker(u, id)"
        />
      </div>
    </div>

    <StorageManager
      :storage-usage="storageUsage"
      :storage-quota="storageQuota"
      :storage-usage-percent="storageUsagePercent"
      @cleanup-old="cleanupOldMarks"
      @cleanup-useless="cleanupUselessMarks"
    />

    <!-- Tag Picker Dialog -->
    <div
      v-if="tagPickerUrl"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="tagPickerUrl = null"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5 w-80 max-w-full mx-4">
        <h3 class="text-base font-semibold mb-3 text-gray-800 dark:text-gray-200">
          标签
        </h3>
        <div class="space-y-2 max-h-60 overflow-y-auto">
          <label class="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
            <input
              type="checkbox"
              :checked="isPageTagChecked('inbox')"
              class="h-4 w-4"
              @change="togglePageTag('inbox')"
            >
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
              class="h-4 w-4"
              @change="togglePageTag(tag.id)"
            >
            <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: tag.color }" />
            <span class="text-sm text-gray-700 dark:text-gray-200">{{ tag.name }}</span>
          </label>
        </div>
        <div class="flex justify-end mt-4">
          <button
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            @click="tagPickerUrl = null"
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
        <h3 class="text-base font-semibold mb-3 text-gray-800 dark:text-gray-200">
          重命名标签
        </h3>
        <input
          v-model="editingTagName"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="输入新标签名称"
          @keydown.enter.prevent="confirmRename"
          @keydown.esc="cancelRename"
        >
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
summary::-webkit-details-marker {
  display: none;
}
summary {
  list-style: none;
}
</style>
