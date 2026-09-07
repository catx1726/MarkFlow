<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { MENU_HEIGHTS, shouldMenuOpenUp } from '../composables/menuPosition'
import { FOLD, isLargeList, pinAnchorDuringFold } from '../composables/foldAnimation'
import PageSection from './PageSection.vue'
import type { Mark } from '~/logic/storage'
import { t } from '~/logic/i18n'
import type { TagTree } from '~/logic/tagTree'
import { Z_LAYERS } from '~/logic/layers'

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

// --- 文件夹行高测量（供网页级 header 吸顶定位） ---
// ResizeObserver 持续跟踪（字体加载/窗口变化会改变行高），与 Sidepanel 测 header 同一模式
let rowHeightObserver: ResizeObserver | null = null

// --- 文件夹展开/收起动画（Issue #80 修正案） ---
// 拦截 summary 原生瞬切，改用 JS 测量高度动画（与 FoldPanel 同一方案）：
// 内容一次性完整挂载（子树只布局一次），动画作用于容器固定 px 高度，
// 子树不参与每帧重排；grid 0fr↔1fr 方案会每帧子树重排，已弃用。
const detailsRef = ref<HTMLDetailsElement | null>(null)
let closeTimer: number | undefined
let stopFolderPin: (() => void) | null = null

/**
 * 动画结束后停止钉扎：留 pinGraceMs 观察期吸收 details 关闭当帧的残余位移。
 * 校验身份防止快速连点时误杀下一场动画的新钉扎。
 */
function stopFolderPinSoon() {
  const pin = stopFolderPin
  setTimeout(() => {
    if (stopFolderPin === pin) {
      pin?.()
      stopFolderPin = null
    }
  }, FOLD.pinGraceMs)
}

/** 大列表（Issue #80）：距离更长，使用更长的动画时长保证丝滑 */
const largeList = computed(() => isLargeList(props.folder.totalMarks))

function cleanupGrid(grid: HTMLElement) {
  grid.classList.remove('fold-animating')
  grid.style.transition = ''
  grid.style.height = ''
  grid.style.overflow = ''
  grid.style.opacity = ''
}

onMounted(() => {
  const summaryEl = detailsRef.value?.querySelector('summary')
  if (summaryEl) {
    const updateVar = () => {
      document.documentElement.style.setProperty('--folder-row-h', `${summaryEl.offsetHeight + 8}px`)
    }
    updateVar()
    rowHeightObserver = new ResizeObserver(updateVar)
    rowHeightObserver.observe(summaryEl)
  }
})

onUnmounted(() => {
  rowHeightObserver?.disconnect()
})

function onSummaryClick(e: MouseEvent) {
  e.preventDefault()
  const details = detailsRef.value
  const grid = details?.querySelector<HTMLElement>('.folder-grid')
  if (!details || !grid)
    return
  clearTimeout(closeTimer)
  stopFolderPin?.() // 快速连点：立即结束上一次钉扎，避免两个反馈环互相拉扯
  stopFolderPin = pinAnchorDuringFold(grid) // 钉扎 summary 行，防容器塌缩拖动
  const d = largeList.value ? FOLD.largeListDuration : FOLD.heightDuration
  // overflow 用 clip 而非 hidden：clip 不创建滚动容器，内部吸顶头保持相对
  // 视口吸附、平滑滑入上方吸顶层背后（hidden 会使 sticky 失效产生瞬跳）
  grid.classList.add('fold-animating')
  if (details.open) {
    // 收起：固定当前 px 高度 → 过渡到 0 → 结束后再真正关闭 details
    grid.style.overflow = 'clip'
    grid.style.height = `${grid.scrollHeight}px`
    grid.style.transition = `height ${d}ms ease-in, opacity ${d}ms ease-in`
    void grid.offsetHeight // 强制 reflow，确保过渡从当前高度起始
    grid.style.height = '0px'
    grid.style.opacity = '0'
    closeTimer = window.setTimeout(() => {
      details.open = false
      cleanupGrid(grid) // 动画结束移除裁剪窗口，避免遮挡内部菜单
      stopFolderPinSoon()
    }, d)
  }
  else {
    // 展开：先打开（容器高度 0 不可见），测量内容高度后过渡到目标值
    details.open = true
    grid.style.overflow = 'clip'
    grid.style.height = '0px'
    grid.style.opacity = '0'
    requestAnimationFrame(() => {
      const target = grid.scrollHeight
      grid.style.transition = `height ${d}ms ease-out, opacity ${d}ms ease-out`
      grid.style.height = `${target}px`
      grid.style.opacity = '1'
      closeTimer = window.setTimeout(() => {
        cleanupGrid(grid) // 还原为 auto 高度与可见溢出，不裁剪 ⋯ 菜单
        stopFolderPinSoon()
      }, d)
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
    <!-- sticky 吸顶：层级 token 见 src/logic/layers.ts（stickyFolder 介于主 header 与内容之间）；
         top 由 --sidepanel-header-h 驱动（Sidepanel.vue ResizeObserver 测量），调整任一侧时注意联动。
         菜单打开时临时提升至 menuElevated，脱离其他吸顶层的遮挡（Issue #79） -->
    <summary
      class="flex items-center gap-2 p-2 bg-white dark:bg-neutral-800 rounded-md cursor-pointer transition-colors border border-neutral-200 dark:border-neutral-700 list-none select-none sticky top-[var(--sidepanel-header-h,120px)]"
      :class="{ 'opacity-50 grayscale': folder.totalMarks === 0 }"
      :style="{ zIndex: activeFolderMenu === tagId ? Z_LAYERS.menuElevated : Z_LAYERS.stickyFolder }"
      @click="onSummaryClick"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 text-neutral-500 transition-transform duration-200 group-open/folder:rotate-0 rotate-[-90deg]"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="font-bold text-neutral-700 dark:text-neutral-200 flex-1 min-w-0 truncate" :title="folder.tagName">{{ folder.tagName }}</span>
      <span
        class="px-2 py-0.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-300 rounded-full mr-2"
      >
        {{ folder.totalMarks }}
      </span>
      <div class="relative flex-shrink-0" @click.stop>
        <button
          class="p-1 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full"
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
            class="absolute right-0 w-40 bg-white dark:bg-neutral-700 rounded-md border border-neutral-200 dark:border-neutral-600"
            :class="folderMenuUp ? 'bottom-full mb-2' : 'mt-2'"
          >
            <ul class="py-1">
              <li>
                <button
                  class="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600 flex items-center gap-2"
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
                  class="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600 flex items-center gap-2"
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

    <!-- 展开/收起动画由 onSummaryClick 以 JS 测量高度驱动（与 FoldPanel 同一方案），
         原生 details 的 name 互斥手风琴保留；其他文件夹被浏览器自动关闭时无动画（已知限制，接受）。 -->
    <div class="folder-grid">
      <div
        class="folder-content space-y-4 py-2 ml-3 pl-3 border-l-2 border-neutral-200 dark:border-neutral-600"
      >
        <div
          v-if="Object.keys(folder.pages).length === 0"
          class="text-center py-8 text-neutral-400 dark:text-neutral-500 text-sm"
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
  </details>
</template>
