<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { MENU_HEIGHTS, shouldMenuOpenUp } from '../composables/menuPosition'
import PageSection from './PageSection.vue'
import type { Mark } from '~/logic/storage'
import { t } from '~/logic/i18n'
import type { TagTree } from '~/logic/tagTree'

const props = defineProps<{
  tagId: string
  folder: TagTree[string]
  isOpen: boolean
  collapsedUrls: Record<string, boolean>
  collapsedStates: Record<string, Record<string, boolean>>
  expandedTexts: Set<string>
  expandedNotes: Set<string>
  editingMarkId: string | null
  activeMarkMenu: string | null
  activeUrlMenu: string | null
  activeFolderMenu: string | null
  activeGroupMenu: string | null
}>()

const emit = defineEmits<{
  (e: 'toggleFolderMenu', tagId: string): void
  (e: 'export-tag-folder', folder: any): void
  (e: 'open-rename-dialog', tagId: string): void
  (e: 'remove-tag-from-all', tagId: string): void
  // PageSection events forward
  (e: 'toggle-url-collapse', url: string): void
  (e: 'toggle-url-menu', url: string): void
  (e: 'export-markdown', urlData: any): void
  (e: 'open-tag-picker', url: string): void
  (e: 'remove-all-marks', url: string): void
  (e: 'toggle-group', url: string, groupTitle: string, totalMarks: number): void
  (e: 'toggle-group-menu', url: string, groupTitle: string): void
  (e: 'export-group', url: string, group: any): void
  (e: 'open-group-tag-picker', url: string, groupTitle: string): void
  (e: 'remove-group-marks', url: string, group: any): void
  (e: 'goto-mark', mark: Mark): void
  (e: 'edit-mark', mark: Mark): void
  (e: 'save-note', mark: Mark, note: string): void
  (e: 'cancel-edit'): void
  (e: 'remove-mark', mark: Mark): void
  (e: 'copy-mark', mark: Mark): void
  (e: 'toggle-text-expansion', markId: string): void
  (e: 'toggle-note-expansion', markId: string): void
  (e: 'toggle-mark-menu', markId: string): void
  (e: 'open-mark-tag-picker', url: string, markId: string): void
}>()

function isUrlCollapsed(url: string): boolean {
  return !!props.collapsedUrls[url]
}

// --- 菜单翻向：底部空间不足时向上弹出 ---
const folderMenuUp = ref(false)

function onFolderMenuClick(e: MouseEvent) {
  folderMenuUp.value = shouldMenuOpenUp(e, MENU_HEIGHTS.folder)
  emit('toggleFolderMenu', props.tagId)
}

// --- 文件夹展开/收起高度动画（Grid 0fr↔1fr） ---
// 拦截 summary 原生瞬切：收起时先播动画再真正关闭 details
const detailsRef = ref<HTMLDetailsElement | null>(null)
const foldOpen = ref(false)
const foldAnim = ref(false)
let closeTimer: number | undefined

onMounted(() => {
  // 初始状态同步（如 inbox 默认展开），不播动画
  foldOpen.value = props.isOpen
})

function onSummaryClick(e: MouseEvent) {
  e.preventDefault()
  const details = detailsRef.value
  if (!details)
    return
  clearTimeout(closeTimer)
  foldAnim.value = true
  if (details.open) {
    // 收起：先播动画，结束后再真正关闭
    foldOpen.value = false
    closeTimer = window.setTimeout(() => {
      details.open = false
      foldAnim.value = false // 动画结束后移除裁剪窗口，避免遮挡内部菜单
    }, 150)
  }
  else {
    // 展开：先打开（内容被 0fr 裁剪不可见），下一帧再播展开动画
    details.open = true
    foldOpen.value = false
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        foldOpen.value = true
        // 动画结束后移除裁剪窗口，避免遮挡内部菜单
        window.setTimeout(() => {
          foldAnim.value = false
        }, 160)
      })
    })
  }
}
</script>

<template>
  <details
    ref="detailsRef"
    name="tag-folder"
    :open="isOpen"
    class="mb-6 group/folder"
  >
    <!-- sticky 吸顶：z-30 介于主 header（z-40）与内容之间；top 由 --sidepanel-header-h 驱动（Sidepanel.vue ResizeObserver 测量），调整任一侧时注意联动 -->
    <summary
      class="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-700 list-none sticky z-30 top-[var(--sidepanel-header-h,104px)]"
      :class="{ 'opacity-50 grayscale': folder.totalMarks === 0 }"
      @click="onSummaryClick"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 text-gray-500 transition-transform duration-200 group-open/folder:rotate-0 rotate-[-90deg]"
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
      <span
        class="px-2 py-0.5 text-xs font-semibold bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 rounded-full mr-2"
      >
        {{ folder.totalMarks }}
      </span>
      <div class="relative flex-shrink-0" @click.stop>
        <button
          class="p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded-full"
          @click.stop="onFolderMenuClick"
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
            class="absolute right-0 w-40 bg-white dark:bg-gray-700 rounded-md shadow-lg z-20 border border-gray-200 dark:border-gray-600"
            :class="folderMenuUp ? 'bottom-full mb-2' : 'mt-2'"
          >
            <ul class="py-1">
              <li>
                <button
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                  @click="emit('export-tag-folder', folder)"
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
                  <span>{{ t('common.export') }}</span>
                </button>
              </li>
              <li>
                <button
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                  @click="emit('open-rename-dialog', tagId)"
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
                  <span>{{ t('common.rename') }}</span>
                </button>
              </li>
              <li v-if="tagId !== 'inbox'">
                <button
                  class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2"
                  @click="emit('remove-tag-from-all', tagId)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <span>{{ t('sidepanel.deleteTag') }}</span>
                </button>
              </li>
            </ul>
          </div>
        </transition>
      </div>
    </summary>

    <!-- 高度动画结构：folder-grid(0fr↔1fr) > fold-inner(裁剪) > folder-content，
         与 PageSection 的 fold-* 同一 Grid 技巧；时长保持 150ms 同步 -->
    <div class="folder-grid" :class="{ 'fold-anim': foldAnim, 'fold-open': foldOpen }">
      <div class="fold-inner">
        <div
          class="folder-content space-y-4 py-2 ml-3 pl-3 border-l-2 border-gray-200 dark:border-gray-600"
        >
          <div
            v-if="Object.keys(folder.pages).length === 0"
            class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm"
          >
            {{ t('sidepanel.emptyFolder') }}
          </div>
          <PageSection
            v-for="[url, urlData] in Object.entries(folder.pages)"
            :key="url"
            :url="url"
            :url-data="urlData as any"
            :is-collapsed="isUrlCollapsed(url)"
            :collapsed-states="collapsedStates[url] || {}"
            :expanded-texts="expandedTexts"
            :expanded-notes="expandedNotes"
            :editing-mark-id="editingMarkId"
            :active-mark-menu="activeMarkMenu"
            :active-group-menu="activeGroupMenu"
            :active-url-menu="activeUrlMenu"
            @toggle-url-collapse="u => emit('toggle-url-collapse', u)"
            @toggle-url-menu="u => emit('toggle-url-menu', u)"
            @export-markdown="data => emit('export-markdown', data)"
            @open-tag-picker="u => emit('open-tag-picker', u)"
            @remove-all-marks="u => emit('remove-all-marks', u)"
            @toggle-group="(u, title, total) => emit('toggle-group', u, title, total)"
            @toggle-group-menu="(u, title) => emit('toggle-group-menu', u, title)"
            @export-group="(u, group) => emit('export-group', u, group)"
            @open-group-tag-picker="(u, title) => emit('open-group-tag-picker', u, title)"
            @remove-group-marks="(u, group) => emit('remove-group-marks', u, group)"
            @goto-mark="mark => emit('goto-mark', mark)"
            @edit-mark="mark => emit('edit-mark', mark)"
            @save-note="(mark, note) => emit('save-note', mark, note)"
            @cancel-edit="() => emit('cancel-edit')"
            @remove-mark="mark => emit('remove-mark', mark)"
            @copy-mark="mark => emit('copy-mark', mark)"
            @toggle-text-expansion="id => emit('toggle-text-expansion', id)"
            @toggle-note-expansion="id => emit('toggle-note-expansion', id)"
            @toggle-mark-menu="id => emit('toggle-mark-menu', id)"
            @open-mark-tag-picker="(u, id) => emit('open-mark-tag-picker', u, id)"
          />
        </div>
      </div>
    </div>
  </details>
</template>

<style scoped>
/* 文件夹展开/收起动画：Grid 0fr↔1fr（与 PageSection fold-* 同一技巧，150ms 保持同步）。
   原生 details 的 name 互斥手风琴保留；其他文件夹被浏览器自动关闭时无动画（已知限制，接受）。
   注意：overflow 裁剪仅在 fold-anim 动画期生效——常驻会裁剪内部标记/分组的⋯下拉菜单。
   收起状态下由 details 原生隐藏内容，无需 overflow。 */
.folder-grid {
  display: grid;
  grid-template-rows: 0fr;
}
.fold-inner {
  min-height: 0;
}
.folder-grid.fold-anim {
  transition: grid-template-rows 150ms ease-out;
}
.folder-grid.fold-anim .fold-inner {
  overflow: hidden;
  contain: layout paint;
}
.folder-grid.fold-open {
  grid-template-rows: 1fr;
}
</style>
