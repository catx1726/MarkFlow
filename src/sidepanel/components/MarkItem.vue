<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Mark } from '~/logic/storage'

const props = defineProps<{
  mark: Mark
  isExpanded: boolean
  isNoteExpanded: boolean
  isEditing: boolean
  activeMenu: string | null
}>()

const emit = defineEmits<{
  (e: 'goto', mark: Mark): void
  (e: 'edit', mark: Mark): void
  (e: 'save', mark: Mark, note: string): void
  (e: 'cancel'): void
  (e: 'remove', mark: Mark): void
  (e: 'copy', mark: Mark): void
  (e: 'toggle-expand', markId: string): void
  (e: 'toggle-note-expand', markId: string): void
  (e: 'toggle-menu', markId: string): void
  (e: 'open-tag-picker', mark: Mark): void
}>()

const editingNote = ref(props.mark.note)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const showContext = ref(false)
const hasContext = computed(() => !!props.mark.contextTitle || !!props.mark.surroundingSnippet)
const contextHint = computed(() => props.mark.restoreFailedAt ? '原位置已变化' : '')

watch(() => props.isEditing, async (newVal) => {
  if (newVal) {
    editingNote.value = props.mark.note
    await nextTick()
    textareaRef.value?.focus()
  }
})

function handleSave() {
  emit('save', props.mark, editingNote.value)
}
</script>

<template>
  <li class="group relative flex items-start gap-2">
    <div
      class="color-indicator h-[20px] w-1 flex-shrink-0 rounded-full"
      :style="{ backgroundColor: mark.color }"
    />
    <div class="min-w-0 flex-1">
      <div class="cursor-pointer" @click="emit('goto', mark)">
        <div
          class="rich-text-content text-gray-800 dark:text-gray-200 ease-in-out max-w-none overflow-hidden text-sm font-medium transition-all duration-300"
          :class="isExpanded ? 'max-h-96' : 'max-h-5'"
          v-html="mark.html || mark.text"
        />
      </div>
      <div
        v-if="mark.restoreFailedAt && hasContext"
        class="mt-1"
      >
        <button
          class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
          @click.stop="showContext = !showContext"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clip-rule="evenodd"
            />
          </svg>
          <span>{{ contextHint }}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3 transition-transform duration-200"
            :class="showContext ? 'rotate-180' : ''"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        <div
          v-if="showContext"
          class="mt-1 rounded border border-amber-200 bg-amber-50 p-2 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200"
        >
          <p
            v-if="mark.contextTitle"
            class="text-xs font-medium"
          >
            章节：{{ mark.contextTitle }}
          </p>
          <p
            v-if="mark.surroundingSnippet"
            class="mt-1 text-xs italic"
          >
            “{{ mark.surroundingSnippet }}”
          </p>
        </div>
      </div>
      <div v-if="isEditing" class="mt-2">
        <textarea
          ref="textareaRef"
          v-model="editingNote"
          class="border-gray-300 dark:bg-gray-700 dark:border-gray-600 w-full rounded-md p-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          @keydown.enter.prevent="handleSave"
          @keydown.esc="emit('cancel')"
        />
        <div class="mt-2 flex justify-end gap-2">
          <button
            class="action-button bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded-md px-3 py-1 text-sm font-medium"
            @click.stop="emit('cancel')"
          >
            取消
          </button>
          <button
            class="action-button bg-amber-500 hover:bg-amber-600 rounded-md px-3 py-1 text-sm font-medium text-gray-900"
            @click.stop="handleSave"
          >
            保存
          </button>
        </div>
      </div>
      <p
        v-else
        :title="mark.note"
        class="text-gray-500 dark:text-gray-400 dark:hover:text-amber-400 ease-in-out mt-1 cursor-pointer overflow-hidden text-xs transition-all duration-300 hover:text-amber-600"
        :class="isNoteExpanded ? 'max-h-96' : 'max-h-5'"
        @click.stop="emit('edit', mark)"
      >
        {{ mark.note || '点击添加备注...' }}
      </p>
    </div>
    <div class="relative flex-shrink-0">
      <button
        class="text-gray-400 hover:text-gray-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        title="更多操作"
        @click.stop="emit('toggle-menu', mark.id)"
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
          v-if="activeMenu === mark.id"
          class="bg-white border-gray-200 dark:bg-gray-700 dark:border-gray-600 absolute right-0 z-30 mt-2 w-48 rounded-md border shadow-lg"
          @click.stop
        >
          <div class="py-1">
            <button
              class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
              @click="emit('toggle-expand', mark.id)"
            >
              <span>{{ isExpanded ? '收起标记' : '展开标记' }}</span>
            </button>
            <button
              v-if="mark.note"
              class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
              @click="emit('toggle-note-expand', mark.id)"
            >
              <span>{{ isNoteExpanded ? '收起备注' : '展开备注' }}</span>
            </button>
            <div class="border-gray-100 dark:border-gray-600 my-1 border-t" />
            <button
              class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full px-4 py-2 text-left text-sm"
              @click="emit('open-tag-picker', mark)"
            >
              管理标签
            </button>

            <button
              class="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
              @click="emit('copy', mark)"
            >
              <span>复制标记</span>
            </button>
            <button
              class="hover:bg-red-50 dark:hover:bg-red-900/50 w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400"
              @click="emit('remove', mark)"
            >
              删除标记
            </button>
          </div>
        </div>
      </transition>
    </div>
  </li>
</template>
