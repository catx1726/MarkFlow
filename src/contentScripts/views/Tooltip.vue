<!-- src/contentScripts/views/Tooltip.vue -->
<template>
  <div
    v-if="visible"
    class="tooltip-card fixed z-[9999] w-[320px] rounded-lg bg-white p-[12px] font-sans shadow-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
    :style="{ top: `${position.y}px`, left: `${position.x}px`, zIndex: zIndex }"
    @mousedown.stop
  >
    <div class="tooltip-content flex flex-col gap-[12px]">
      <div class="tooltip-header flex justify-between items-center mb-[-4px]">
        <div class="tooltip-colors flex gap-[4px] items-center">
          <button
            v-for="color in highlightColors"
            :key="color"
            class="color-swatch h-[18px] w-[18px] cursor-pointer rounded-full border-[2px] border-transparent p-0 transition-all duration-200 ease-in-out transform hover:scale-110 relative dark:border-gray-800"
            :style="{ backgroundColor: color }"
            :class="{ 'is-selected !border-blue-500 dark:!border-blue-400': selectedColor === color }"
            @click="selectedColor = color"
          />
        </div>
        <div class="text-[10px] text-gray-400 font-medium">MarkFlow</div>
      </div>

      <!-- 标签管理区 -->
      <div
        class="tag-section bg-gray-50 dark:bg-gray-900/50 p-2 rounded-md border border-gray-100 dark:border-gray-700"
      >
        <p class="text-[10px] text-gray-400 uppercase font-bold mb-1.5 flex justify-between">
          <span>关联标签</span>
        </p>
        <div class="flex flex-wrap gap-1 max-h-[72px] overflow-y-auto custom-scrollbar">
          <button
            v-for="tag in allTags"
            :key="tag.id"
            class="text-[10px] px-2 py-0.5 rounded-full border transition-all duration-200"
            :class="
              selectedTags.includes(tag.id)
                ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300'
                : 'bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 hover:border-blue-400'
            "
            @click="toggleTag(tag.id)"
          >
            {{ tag.name }}
          </button>
          <span v-if="allTags.length === 0" class="text-[10px] text-gray-400 italic">暂无标签</span>
        </div>
        <div class="flex gap-1 mt-1.5">
          <input
            v-model="newTagInput"
            placeholder="+ 新建标签"
            class="flex-1 px-2 py-1 text-[10px] border border-gray-200 dark:border-gray-600 rounded dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            @keydown.enter.prevent="handleCreateTag"
          />
          <button
            class="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            :disabled="!newTagInput.trim()"
            @click="handleCreateTag"
          >
            创建
          </button>
        </div>
      </div>

      <textarea
        ref="textareaRef"
        v-model="noteValue"
        class="tooltip-textarea min-h-[80px] w-full resize-y rounded-md border border-gray-300 p-[8px] text-[14px] leading-relaxed focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        placeholder="在这里记录你的笔记或思考..."
        @keydown.enter.ctrl.prevent="onSaveClick"
        @keydown.esc="hide"
      />

      <div class="tooltip-actions flex justify-between items-center w-full">
        <div class="flex gap-2">
          <button
            class="action-button p-[6px] text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
            title="复制文本"
            @click="onCopyClick"
          >
            <svg
              v-if="copySuccess"
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5 text-green-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
              <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h6a2 2 0 00-2-2H5z" />
            </svg>
          </button>
        </div>

        <div class="flex gap-2">
          <button
            v-if="isHighlighted"
            class="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors"
            @click="onDeleteClick"
          >
            删除
          </button>
          <button
            class="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
            @click="onSaveClick"
          >
            {{ isHighlighted ? '保存修改' : '确认高亮' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, toRaw, watch } from 'vue'
import { sendMessage } from 'webext-bridge/content-script'
import { settings } from '~/logic/settings'
import type { Tag } from '~/logic/storage'
import { getMaxZIndex } from '../../logic/dom'

const visible = ref(false)
const position = reactive({ x: 0, y: 0 })
const isHighlighted = ref(false)
const noteValue = ref('')
const selectedTags = ref<string[]>([])
const selectedColor = ref(settings.value.defaultHighlightColor)
const highlightColors = computed(() => settings.value.highlightColors)
const defaultHighlightColor = computed(() => settings.value.defaultHighlightColor)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const textToCopy = ref('')
const copySuccess = ref(false)
const zIndex = ref(0)

const newTagInput = ref('')
const fetchedTags = ref<Record<string, Tag>>({})
const allTags = computed(() => Object.values(fetchedTags.value).sort((a, b) => b.createdAt - a.createdAt))

async function handleCreateTag() {
  const name = newTagInput.value.trim()
  if (!name) return
  const newTag = await sendMessage('create-tag', { name }, 'background')
  if (newTag) {
    fetchedTags.value[newTag.id] = newTag
    selectedTags.value.push(newTag.id)
  }
  newTagInput.value = ''
}

function toggleTag(tagId: string) {
  const index = selectedTags.value.indexOf(tagId)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tagId)
  }
}

const emit = defineEmits<{
  (e: 'save', note: string, color: string, tags: string[]): void
  (e: 'delete'): void
  (e: 'color-change', color: string, isExisting: boolean): void
  (e: 'clear-preview'): void
}>()

watch(selectedColor, (newColor) => {
  emit('color-change', newColor, isHighlighted.value)
})

const isMac = /mac/i.test(navigator.platform)

const handleKeydown = (event: KeyboardEvent) => {
  if (!visible.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    if (!isHighlighted.value) emit('clear-preview')
    hide()
    return
  }

  // Ctrl+Enter to save
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    onSaveClick()
    return
  }
}

async function onCopyClick() {
  if (!textToCopy.value) return
  try {
    await navigator.clipboard.writeText(textToCopy.value)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 1500)
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
}

function onSaveClick() {
  emit('save', noteValue.value, selectedColor.value, toRaw(selectedTags.value))
  hide()
}

function onDeleteClick() {
  emit('delete')
  hide()
}

async function show(
  x: number,
  y: number,
  highlighted: boolean,
  initialNote = '',
  initialColor: string | undefined,
  initialTextToCopy = '',
  initialTags: string[] = []
) {
  // 异步获取最新标签，遵循 SSOT
  fetchedTags.value = await sendMessage('get-all-tags', {}, 'background')
  
  zIndex.value = getMaxZIndex() + 100
  const tooltipWidth = 320
  const tooltipHeight = 340
  const margin = 10
  if (x + tooltipWidth > window.innerWidth) x = window.innerWidth - tooltipWidth - margin
  if (y + tooltipHeight > window.innerHeight) y = window.innerHeight - tooltipHeight - margin
  if (x < margin) x = margin
  if (y < margin) y = margin
  position.x = x
  position.y = y
  isHighlighted.value = highlighted
  noteValue.value = initialNote
  selectedTags.value = [...initialTags]
  selectedColor.value = initialColor || defaultHighlightColor.value
  textToCopy.value = initialTextToCopy
  visible.value = true
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function hide() {
  if (visible.value && !isHighlighted.value) {
    emit('clear-preview')
  }
  visible.value = false
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true)
})

defineExpose({ show, hide })
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #475569;
}
</style>
