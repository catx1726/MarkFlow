<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { MENU_HEIGHTS, shouldMenuOpenUp } from '../composables/menuPosition'
import { FOLD } from '../composables/foldAnimation'
import FoldPanel from './FoldPanel.vue'
import MarkItem from './MarkItem.vue'
import type { Mark } from '~/logic/storage'
import { t } from '~/logic/i18n'
import type { MarkGroup } from '~/logic/tagTree'
import { Z_LAYERS } from '~/logic/layers'

const props = defineProps<{
  url: string
  urlData: {
    pageTitle: string
    groups: MarkGroup[]
    totalMarks: number
  }
  isCollapsed: boolean
  collapsedStates: Record<string, boolean>
  expandedTexts: Set<string>
  expandedNotes: Set<string>
  editingMarkId: string | null
  activeMarkMenu: string | null
  activeGroupMenu: string | null
  activeUrlMenu: string | null
}>()

const emit = defineEmits<{
  (e: 'toggle-url-collapse', url: string): void
  (e: 'toggleUrlMenu', url: string): void
  (e: 'export-markdown', urlData: any): void
  (e: 'open-tag-picker', url: string): void
  (e: 'remove-all-marks', url: string): void
  (e: 'toggle-group', url: string, groupTitle: string, totalMarks: number): void
  (e: 'toggleGroupMenu', url: string, groupTitle: string): void
  (e: 'export-group', url: string, group: any): void
  (e: 'open-group-tag-picker', url: string, groupTitle: string): void
  (e: 'remove-group-marks', url: string, group: any): void
  // MarkItem events
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

function getLevelClass(level: number) {
  const levelStyles: Record<number, string> = {
    1: 'text-sm font-bold text-neutral-900 dark:text-neutral-100',
    2: 'text-sm font-semibold text-neutral-800 dark:text-neutral-200',
    3: 'text-xs font-semibold text-neutral-700 dark:text-neutral-300',
    4: 'text-xs font-medium text-neutral-600 dark:text-neutral-400',
    5: 'text-xs font-medium text-neutral-600 dark:text-neutral-400',
    6: 'text-xs font-medium text-neutral-600 dark:text-neutral-400',
  }
  return levelStyles[level] || 'text-xs font-medium text-neutral-500 dark:text-neutral-500'
}

function getLevelStripeStyle(level: number) {
  // 层级指示条用 inset box-shadow 而非 border-left：不参与盒模型，
  // 杜绝任何潜在的边框宽度参与布局计算（用户反馈排查项）
  const styles: Record<number, Record<string, string>> = {
    1: { boxShadow: 'inset 4px 0 0 #F59E0B' },
    2: { boxShadow: 'inset 3px 0 0 #FBBF24' },
    3: { boxShadow: 'inset 2px 0 0 #FCD34D' },
    4: { boxShadow: 'inset 1px 0 0 #FDE68A' },
    5: { boxShadow: 'inset 1px 0 0 #FDE68A' },
    6: { boxShadow: 'inset 1px 0 0 #FDE68A' },
  }
  return styles[level] || { boxShadow: 'inset 1px 0 0 #FDE68A' }
}

// --- 菜单翻向：底部空间不足时向上弹出（同 MarkItem） ---
const urlMenuUp = ref(false)
const groupMenuUp = ref(false)

// --- 网页 header 高度测量（供章节组吸顶定位） ---
const pageHeaderRef = ref<HTMLElement | null>(null)

onMounted(() => {
  // 所有网页 header 行高一致，任一实例测量即可
  if (pageHeaderRef.value)
    document.documentElement.style.setProperty('--page-header-h', `${pageHeaderRef.value.offsetHeight}px`)
})

function onUrlMenuClick(e: MouseEvent) {
  urlMenuUp.value = shouldMenuOpenUp(e, MENU_HEIGHTS.url)
  emit('toggleUrlMenu', props.url)
}

function onGroupMenuClick(e: MouseEvent, groupTitle: string) {
  groupMenuUp.value = shouldMenuOpenUp(e, MENU_HEIGHTS.group)
  emit('toggleGroupMenu', props.url, groupTitle)
}

function isGroupCollapsed(groupTitle: string): boolean {
  const state = props.collapsedStates[groupTitle]
  if (state !== undefined)
    return state
  return props.urlData.totalMarks > FOLD.defaultCollapseMarkThreshold
}
</script>

<template>
  <section
    class="bg-white border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 rounded-md border p-[12px]"
  >
    <!-- 网页级吸顶：top = 主 header 高 + 文件夹行高；两个 CSS 变量分别由
         Sidepanel.vue / TagFolder.vue 用 ResizeObserver 运行时测量写入，fallback 值（120/40）为估计值，
         调整任一侧高度时无需改此处（变量会覆盖）。层级 token 见 src/logic/layers.ts：
         stickyHeader > stickyFolder > stickyPage；菜单打开时临时提升至 menuElevated（Issue #79） -->
    <header
      class="bg-white dark:border-neutral-700 group/page fold-sticky sticky top-[calc(var(--sidepanel-header-h,120px)+var(--folder-row-h,40px))] flex cursor-pointer items-center justify-between border-b pb-[8px] mb-[8px] dark:bg-neutral-800"
      :style="{ zIndex: activeUrlMenu === url ? Z_LAYERS.menuElevated : Z_LAYERS.stickyPage }"
      @click="emit('toggle-url-collapse', url)"
    >
      <div class="min-w-0 flex-1 flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-[14px] w-[14px] flex-shrink-0 text-neutral-400 transition-transform duration-200 group-hover/page:text-neutral-600"
          :class="{ 'rotate-[-90deg]': isCollapsed }"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
        <h2 class="dark:text-neutral-300 min-w-0 flex-1 truncate text-sm font-semibold text-neutral-700" :title="url">
          {{ urlData.pageTitle }}
        </h2>
        <span class="text-neutral-400 text-xs font-normal flex-shrink-0">({{ urlData.totalMarks }})</span>
      </div>
      <div class="relative flex-shrink-0" @click.stop>
        <button
          class="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full p-1"
          @click="onUrlMenuClick"
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
            class="bg-white border-neutral-200 dark:bg-neutral-700 dark:border-neutral-600 absolute right-0 w-32 rounded-md border"
            :class="urlMenuUp ? 'bottom-full mb-2' : 'mt-2'"
          >
            <ul class="py-1">
              <li>
                <button
                  class="text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600 flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
                  @click="emit('export-markdown', urlData)"
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
                  class="text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600 flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
                  @click="emit('open-tag-picker', url)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.266 0 .52.105.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                  </svg>
                  <span>{{ t('common.manageTags') }}</span>
                </button>
              </li>
              <li>
                <button
                  class="hover:bg-red-50 dark:hover:bg-red-900/50 flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 dark:text-red-400"
                  @click="emit('remove-all-marks', url)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <span>{{ t('sidepanel.clearMarks') }}</span>
                </button>
              </li>
            </ul>
          </div>
        </transition>
      </div>
    </header>
    <FoldPanel :show="!isCollapsed" :mark-count="urlData.totalMarks">
      <div>
        <div v-for="group in urlData.groups" :key="group.title" class="group-container">
          <header
            class="group group-header mt-1 fold-sticky sticky top-[calc(var(--sidepanel-header-h,120px)+var(--folder-row-h,40px)+var(--page-header-h,38px))] -mx-2 flex cursor-pointer items-center justify-between bg-white px-2 py-2 transition-colors dark:bg-neutral-800"
            :style="[getLevelStripeStyle(group.level), { zIndex: activeGroupMenu === `${url}|${group.title}` ? Z_LAYERS.menuElevated : Z_LAYERS.stickyChapter }]"
            @click="emit('toggle-group', url, group.title, urlData.totalMarks)"
          >
            <h3 class="min-w-0 flex-1 truncate" :class="getLevelClass(group.level)">
              {{ group.title }}
            </h3>
            <span class="text-neutral-400 text-xs font-normal flex-shrink-0">({{ group.count }})</span>
            <div class="relative ml-2 flex-shrink-0" @click.stop>
              <button
                class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100"
                :title="t('sidepanel.groupActions')"
                @click="e => onGroupMenuClick(e, group.title)"
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
                  class="bg-white border-neutral-200 dark:bg-neutral-700 dark:border-neutral-600 absolute right-0 w-36 rounded-md border"
                  :class="groupMenuUp ? 'bottom-full mb-2' : 'mt-1'"
                >
                  <ul class="py-1">
                    <li>
                      <button
                        class="text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                        @click="emit('export-group', url, group)"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>{{ t('common.export') }}</span>
                      </button>
                    </li>
                    <li>
                      <button
                        class="text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                        @click="emit('open-group-tag-picker', url, group.title)"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.266 0 .52.105.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                        </svg>
                        <span>{{ t('common.manageTags') }}</span>
                      </button>
                    </li>
                    <li>
                      <button
                        class="hover:bg-red-50 dark:hover:bg-red-900/50 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 dark:text-red-400"
                        @click="emit('remove-group-marks', url, group)"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                        <span>{{ t('sidepanel.deleteMark') }}</span>
                      </button>
                    </li>
                  </ul>
                </div>
              </transition>
            </div>
          </header>

          <FoldPanel :show="!isGroupCollapsed(group.title)" :mark-count="group.count">
            <ul class="space-y-3 pl-3 pt-2">
              <MarkItem
                v-for="mark in group.marks"
                :key="mark.id"
                :mark="mark"
                :is-expanded="expandedTexts.has(mark.id)"
                :is-note-expanded="expandedNotes.has(mark.id)"
                :is-editing="editingMarkId === mark.id"
                :active-menu="activeMarkMenu"
                @goto="m => emit('goto-mark', m)"
                @edit="m => emit('edit-mark', m)"
                @save="(m, note) => emit('save-note', m, note)"
                @cancel="() => emit('cancel-edit')"
                @remove="m => emit('remove-mark', m)"
                @copy="m => emit('copy-mark', m)"
                @toggle-expand="id => emit('toggle-text-expansion', id)"
                @toggle-note-expand="id => emit('toggle-note-expansion', id)"
                @toggle-menu="id => emit('toggle-mark-menu', id)"
                @open-tag-picker="m => emit('open-mark-tag-picker', url, m.id)"
              />
            </ul>
          </FoldPanel>
        </div>
      </div>
    </FoldPanel>
  </section>
</template>

<style scoped>
/* 吸顶约束范围：group-container 若为普通块级盒，收起后容器高度只剩 header 本身，
   sticky 底部约束立即失效——吸顶中的 header 会弹回自然位置（深吸顶时直接飞出视口
   顶部），展开时面板长高又中途吸回，即收起/展开的上下抖动。
   display:contents 使 header 的 sticky 约束父级成为整个分组列表容器：
   收起/展开全程稳定吸顶；后续 header 滚到吸顶线后按 DOM 序覆盖前一个（堆叠吸顶）。
   间距 mt-1 相应从容器移到 header 上（容器已无盒子，margin 不生效）。 */
.group-container {
  display: contents;
}
</style>
