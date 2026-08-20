<script setup lang="ts">
import MarkItem from './MarkItem.vue'
import type { Mark } from '~/logic/storage'
import type { MarkGroup } from '~/logic/tagTree'

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
  (e: 'toggle-url-menu', url: string): void
  (e: 'export-markdown', urlData: any): void
  (e: 'open-tag-picker', url: string): void
  (e: 'remove-all-marks', url: string): void
  (e: 'toggle-group', url: string, groupTitle: string, totalMarks: number): void
  (e: 'toggle-group-menu', url: string, groupTitle: string): void
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
    1: 'text-sm font-bold text-gray-900 dark:text-gray-100',
    2: 'text-sm font-semibold text-gray-800 dark:text-gray-200',
    3: 'text-xs font-semibold text-gray-700 dark:text-gray-300',
    4: 'text-xs font-medium text-gray-600 dark:text-gray-400',
    5: 'text-xs font-medium text-gray-600 dark:text-gray-400',
    6: 'text-xs font-medium text-gray-600 dark:text-gray-400',
  }
  return levelStyles[level] || 'text-xs font-medium text-gray-500 dark:text-gray-500'
}

function getLevelBorderStyle(level: number) {
  const styles: Record<number, Record<string, string>> = {
    1: { borderLeft: '4px solid #F59E0B' },
    2: { borderLeft: '3px solid #FBBF24' },
    3: { borderLeft: '2px solid #FCD34D' },
    4: { borderLeft: '1px solid #FDE68A' },
    5: { borderLeft: '1px solid #FDE68A' },
    6: { borderLeft: '1px solid #FDE68A' },
  }
  return styles[level] || { borderLeft: '1px solid #FDE68A' }
}

function isGroupCollapsed(groupTitle: string): boolean {
  const state = props.collapsedStates[groupTitle]
  if (state !== undefined)
    return state
  return props.urlData.totalMarks > 15
}
</script>

<template>
  <section
    class="bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700 rounded-lg border p-[12px]"
  >
    <header
      class="border-gray-200 dark:border-gray-700 group/page flex cursor-pointer items-center justify-between border-b pb-[8px] mb-[8px]"
      @click="emit('toggle-url-collapse', url)"
    >
      <div class="min-w-0 flex-1 flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-[14px] w-[14px] flex-shrink-0 text-gray-400 transition-transform duration-200 group-hover/page:text-gray-600"
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
        <h2 class="dark:text-gray-300 truncate text-sm font-semibold text-gray-700" :title="url">
          {{ urlData.pageTitle }}
        </h2>
      </div>
      <div class="relative flex-shrink-0" @click.stop>
        <button
          class="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded-full p-1"
          @click="emit('toggle-url-menu', url)"
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
            class="bg-white border-gray-200 dark:bg-gray-700 dark:border-gray-600 absolute right-0 z-20 mt-2 w-32 rounded-md border shadow-lg"
          >
            <ul class="py-1">
              <li>
                <button
                  class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
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
                  <span>导出</span>
                </button>
              </li>
              <li>
                <button
                  class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
                  @click="emit('open-tag-picker', url)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.266 0 .52.105.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                  </svg>
                  <span>管理标签</span>
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
                  <span>清空标记</span>
                </button>
              </li>
            </ul>
          </div>
        </transition>
      </div>
    </header>
    <Transition
      enter-active-class="fold-enter-active"
      enter-from-class="fold-collapsed"
      leave-active-class="fold-leave-active"
      leave-to-class="fold-collapsed"
    >
      <div v-if="!isCollapsed" class="fold-grid">
        <div class="fold-inner">
          <div v-for="group in urlData.groups" :key="group.title" class="group-container mt-1">
            <header
              class="group group-header hover:bg-gray-100 dark:hover:bg-gray-800 -mx-2 flex cursor-pointer items-center justify-between px-2 py-2 transition-colors"
              :style="getLevelBorderStyle(group.level)"
              @click="emit('toggle-group', url, group.title, urlData.totalMarks)"
            >
              <h3 class="min-w-0 flex-1 truncate" :class="getLevelClass(group.level)">
                {{ group.title }}
                <span class="text-gray-400 text-xs font-normal">({{ group.count }})</span>
              </h3>
              <div class="relative ml-2 flex-shrink-0" @click.stop>
                <button
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  title="分组操作"
                  @click="emit('toggle-group-menu', url, group.title)"
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
                    class="bg-white border-gray-200 dark:bg-gray-700 dark:border-gray-600 absolute right-0 z-20 mt-1 w-36 rounded-md border shadow-lg"
                  >
                    <ul class="py-1">
                      <li>
                        <button
                          class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                          @click="emit('export-group', url, group)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>导出</span>
                        </button>
                      </li>
                      <li>
                        <button
                          class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                          @click="emit('open-group-tag-picker', url, group.title)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.266 0 .52.105.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                          </svg>
                          <span>管理标签</span>
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
                          <span>删除标记</span>
                        </button>
                      </li>
                    </ul>
                  </div>
                </transition>
              </div>
            </header>

            <Transition
              enter-active-class="fold-enter-active"
              enter-from-class="fold-collapsed"
              leave-active-class="fold-leave-active"
              leave-to-class="fold-collapsed"
            >
              <div v-if="!isGroupCollapsed(group.title)" class="fold-grid">
                <ul class="fold-inner space-y-3 pl-3 pt-2">
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
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
/* 手风琴高度过渡：CSS Grid 0fr↔1fr 技巧（与 StorageManager 同一约定），
   fr 轨道尺寸可插值；Transition 负责收起动画播完后再卸载（v-if）的时机。
   兼容性：Chrome 107+ / Firefox 66+ / Safari 16+ 支持 fr 轨道插值；
   更老浏览器退化为瞬开瞬关（无动画但功能正常），可接受，不加 @supports 降级。
   注意：overflow/contain 裁剪只在 enter/leave 激活期生效（*-active 类），
   动画结束即移除——常驻会裁剪标记的⋯下拉菜单（absolute 定位超出容器） */
.fold-grid {
  display: grid;
  grid-template-rows: 1fr;
}
.fold-inner {
  min-height: 0;
}
.fold-collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
}
.fold-enter-active > .fold-inner,
.fold-leave-active > .fold-inner {
  overflow: hidden;
  /* 隔离重排范围：动画每帧只在此子树内布局（大列表卡顿优化） */
  contain: layout paint;
}
.fold-enter-active {
  transition: grid-template-rows 150ms ease-out, opacity 130ms ease-out;
}
.fold-leave-active {
  transition: grid-template-rows 120ms ease-in, opacity 100ms ease-in;
}
</style>
