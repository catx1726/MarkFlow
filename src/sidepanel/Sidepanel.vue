<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRaw, watchEffect } from 'vue'
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
const { structuredMarks, searchQuery, compactMode, setSearchQuery, filteredTree, refreshAllMarks } = useSidepanelData()
const {
  collapsedStates,
  collapsedUrls,
  expandedTexts,
  expandedNotes,
  activeMarkMenu,
  activeUrlMenu,
  activeFolderMenu,
  activeGroupMenu,
  toggleUrlCollapse,
  closeMenus,
} = useUIState()

const editingMarkId = ref<string | null>(null)

const {
  newTagName,
  isCreatingTag,
  tagInputRef,
  tagPickerVisible,
  editingTagId: _editingTagId,
  editingTagName,
  renameDialogVisible,
  createTag,
  startCreatingTag,
  cancelCreatingTag,
  togglePageTag,
  isPageTagChecked,
  openTagPicker,
  closeTagPicker,
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
  exportGroup,
} = useMarkActions()

const {
  storageUsage,
  storageQuota,
  storageUsagePercent,
  refreshUsage,
  cleanupOldMarks,
  cleanupUselessMarks,
} = useStorageMonitor()

const isStorageExpanded = ref(false)

// --- Event Handlers ---

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

onMounted(() => {
  refreshUsage()
  refreshAllMarks()
  document.addEventListener('click', closeMenus)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenus)
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

function handleSearchInput(value: string) {
  setSearchQuery(value)
}

function clearSearch() {
  searchQuery.value = ''
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
    class="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 font-sans relative text-gray-800 dark:text-gray-200 flex flex-col gap-4"
    :class="isStorageExpanded ? 'pb-48' : 'pb-16'"
  >
    <SidepanelHeader
      v-model:new-tag-name="newTagName"
      v-model:search-query="searchQuery"
      v-model:compact-mode="compactMode"
      :is-creating-tag="isCreatingTag"
      @create-tag="createTag"
      @open-options="handleOpenOptions"
      @start-creating-tag="startCreatingTag"
      @cancel-creating-tag="cancelCreatingTag"
      @update:search-query="handleSearchInput"
    />

    <div
      class="flex-1 flex flex-col min-h-0"
      :class="Object.keys(marksByUrl).length === 0 && Object.keys(tagsMetadata).length === 0 ? 'items-center justify-center' : ''"
    >
      <div
        v-if="Object.keys(marksByUrl).length === 0 && Object.keys(tagsMetadata).length === 0"
        class="flex flex-col items-center justify-center text-gray-500 rounded-lg bg-white dark:bg-gray-800 p-6 shadow-md py-12"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-16 h-16 text-gray-300"
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
        <p class="mt-4">
          还没有任何标记
        </p>
        <p class="text-sm text-gray-400">
          在网页上按住ALT，然后选中文本试试看
        </p>
      </div>
      <div v-else class="space-y-6">
        <TagFolder
          v-for="[tagId, folder] in Object.entries(filteredTree)"
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

        <div
          v-if="Object.keys(filteredTree).length === 0 && searchQuery.trim()"
          class="text-center text-gray-500 py-8"
        >
          <p>未找到包含「{{ searchQuery }}」的标记</p>
          <button
            class="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            @click="clearSearch"
          >
            清除搜索
          </button>
        </div>
      </div>
    </div>

    <StorageManager
      v-model:expanded="isStorageExpanded"
      :storage-usage="storageUsage"
      :storage-quota="storageQuota"
      :storage-usage-percent="storageUsagePercent"
      @cleanup-old="cleanupOldMarks"
      @cleanup-useless="cleanupUselessMarks"
    />

    <!-- Tag Picker Dialog -->
    <div
      v-if="tagPickerVisible"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="closeTagPicker"
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
/* Sidepanel-only: always reserve scrollbar space with invisible track */
html {
  overflow-y: scroll;
  background-color: var(--scrollbar-page-bg);
  scrollbar-width: thin;
  /* Firefox: thumb color + track color (must be opaque, not transparent) */
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-page-bg);
}
.dark html {
  background-color: var(--scrollbar-page-bg);
}

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
  background-color: var(--code-inline-bg);
  color: var(--code-inline-text);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-weight: 400;
}
.rich-text-content :where(pre) {
  background-color: var(--code-block-bg);
  padding: 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  font-size: 0.875em;
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
