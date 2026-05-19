<!-- src/contentScripts/views/Tooltip.vue -->
<template>
  <div
    v-if="visible"
    class="tooltip-card fixed z-1 w-[300px] rounded-lg bg-white p-[12px] font-sans shadow-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
    :style="{ top: `${position.y}px`, left: `${position.x}px`, zIndex: zIndex }"
    @mousedown.stop
  >
    <div class="tooltip-content flex flex-col gap-[12px]">
      <div class="tooltip-colors flex gap-[4px] items-center">
        <button
          v-for="color in highlightColors"
          :key="color"
          class="color-swatch h-[20px] w-[20px] cursor-pointer rounded-full border-[2px] border-transparent p-0 transition-all duration-200 ease-in-out transform hover:scale-110 hover:translate-y-[-0.25rem] hover:z-20 relative dark:border-gray-800"
          :style="{ backgroundColor: color }"
          :class="{ 'is-selected !border-brand-blue dark:!border-blue-400': selectedColor === color }"
          @click="selectedColor = color"
        />
      </div>

      <!-- 新增：已关联标签展示 -->
      <div v-if="selectedTags.length > 0" class="flex flex-wrap gap-1 mb-1">
        <span 
          v-for="tagId in selectedTags" 
          :key="tagId"
          class="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800"
        >
          # {{ getTagName(tagId) }}
        </span>
      </div>

      <textarea
        ref="textareaRef"
        v-model="noteValue"
        class="tooltip-textarea min-h-[60px] min-w-[250px] resize-y rounded-md border border-gray-300 p-[8px] text-[14px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        placeholder="你正在想什么..."
        @keydown.enter.prevent="onSaveClick"
        @keydown.esc="hide"
      />
      <div class="tooltip-actions flex justify-end w-full gap-[8px]">
        <button
          class="action-button copy-button p-[4px] text-gray-400 hover:text-blue-600 rounded-full dark:hover:text-blue-400"
          title="复制文本"
          @click="onCopyClick"
        >
          <svg
            v-if="copySuccess"
            xmlns="http://www.w3.org/2000/svg"
            class="w-[20px] h-[20px] text-green-500 transition-colors"
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
            class="h-[20px] w-[20px]"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
            <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h6a2 2 0 00-2-2H5z" />
          </svg>
        </button>

        <button
          v-if="isHighlighted"
          class="action-button delete-button rounded-md bg-red-600 px-[12px] py-[6px] text-[14px] font-medium text-white hover:bg-red-700"
          @click="onDeleteClick"
        >
          删除 ({{ shortcutDeleteText }})
        </button>
        <button
          class="action-button save-button rounded-md bg-blue-600 px-[12px] py-[6px] text-[14px] font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          @click="onSaveClick"
        >
          确认 ({{ shortcutSaveText }})
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { settings } from '~/logic/settings'
import { tagsMetadata } from '~/logic/storage'
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

const getTagName = (id: string) => tagsMetadata.value[id]?.name || id

const formatShortcutForDisplay = (shortcut: string) => {
  let text = shortcut
  if (isMac) {
    text = text
      .replace(/meta|cmd|command/gi, '⌘')
      .replace(/ctrl|control/gi, '⌃')
      .replace(/alt/gi, '⌥')
      .replace(/shift/gi, '⇧')
  }
  return text.replace(/\+/g, ' + ')
}
const shortcutSaveText = computed(() => formatShortcutForDisplay(settings.value.shortcutSave))
const shortcutDeleteText = computed(() => formatShortcutForDisplay(settings.value.shortcutDelete))
const isMac = /mac/i.test(navigator.platform)

const emit = defineEmits<{
  (e: 'save', note: string, color: string): void
  (e: 'delete'): void
  (e: 'color-change', color: string, isExisting: boolean): void
  (e: 'clear-preview'): void
}>()

watch(selectedColor, (newColor) => {
  emit('color-change', newColor, isHighlighted.value)
})

const handleKeydown = (event: KeyboardEvent) => {
  if (!visible.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    if (!isHighlighted.value) emit('clear-preview')
    hide()
    return
  }

  const isPrimaryModifierOnly =
    (isMac ? event.metaKey : event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    (isMac ? !event.ctrlKey : !event.metaKey)

  if (event.key.toLowerCase() === 'c' && isPrimaryModifierOnly) {
    if (event.target === textareaRef.value) return
    event.preventDefault()
    event.stopPropagation()
    onCopyClick()
    if (!isHighlighted.value) emit('clear-preview')
    hide()
    return
  }

  const formatShortcut = (shortcut: string) => {
    const parts = shortcut
      .toLowerCase()
      .split('+')
      .map((p) => p.trim())
    const key = parts.pop() || ''
    const alt = parts.includes('alt')
    const ctrl = parts.includes('ctrl') || parts.includes('control')
    const meta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command')
    const shift = parts.includes('shift')
    return { key, alt, ctrl, shift, meta }
  }

  const match = (shortcut: ReturnType<typeof formatShortcut>) => {
    const keyMatches =
      isMac && shortcut.alt && shortcut.key.length === 1 && shortcut.key >= 'a' && shortcut.key <= 'z'
        ? event.code.toLowerCase() === `key${shortcut.key}`
        : event.key.toLowerCase() === shortcut.key

    if (!keyMatches) return false
    if (event.altKey !== shortcut.alt) return false
    if (event.shiftKey !== shortcut.shift) return false
    if (shortcut.meta !== event.metaKey) return false
    if (shortcut.ctrl !== event.ctrlKey) return false

    return true
  }

  if (match(formatShortcut(settings.value.shortcutSave))) {
    event.preventDefault()
    event.stopPropagation()
    onSaveClick()
  } else if (isHighlighted.value && match(formatShortcut(settings.value.shortcutDelete))) {
    event.preventDefault()
    event.stopPropagation()
    onDeleteClick()
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
  emit('save', noteValue.value, selectedColor.value)
  hide()
}

function onDeleteClick() {
  emit('delete')
  hide()
}

function show(
  x: number,
  y: number,
  highlighted: boolean,
  initialNote = '',
  initialColor: string | undefined,
  initialTextToCopy = '',
  initialTags: string[] = []
) {
  zIndex.value = getMaxZIndex()
  const tooltipWidth = 300
  const tooltipHeight = 160
  const margin = 10
  if (x + tooltipWidth > window.innerWidth) x = window.innerWidth - tooltipWidth - margin
  if (y + tooltipHeight > window.innerHeight) y = window.innerHeight - tooltipHeight - margin
  if (x < margin) x = margin
  if (y < margin) y = margin
  position.x = x
  position.y = y
  isHighlighted.value = highlighted
  noteValue.value = initialNote
  selectedTags.value = initialTags
  selectedColor.value = initialColor || defaultHighlightColor.value
  textToCopy.value = initialTextToCopy
  visible.value = true
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function hide() {
  if (visible.value) {
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

<style scoped></style>
