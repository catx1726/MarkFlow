<template>
  <div
    v-if="visible"
    class="tooltip-card fixed z-1 w-[300px] rounded-lg bg-white p-[12px] font-sans shadow-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
    :style="{ top: `${position.y}px`, left: `${position.x}px` }"
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
import { getMaxZIndex } from '..'

const visible = ref(false)
const position = reactive({ x: 0, y: 0 })
const isHighlighted = ref(false)
const noteValue = ref('')
const selectedColor = ref(settings.value.defaultHighlightColor)
const highlightColors = computed(() => settings.value.highlightColors)
const defaultHighlightColor = computed(() => settings.value.defaultHighlightColor)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const textToCopy = ref('')
const copySuccess = ref(false)
const zIndex = ref(0) // 将 zIndex 声明为响应式 ref
const formatShortcutForDisplay = (shortcut: string) => {
  let text = shortcut
  if (isMac) {
    text = text
      .replace(/meta|cmd|command/gi, '⌘') // Command on Mac
      .replace(/ctrl|control/gi, '⌃') // Control on Mac
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
  // 当在工具提示中选择新颜色时，发出一个事件。
  // 对于新选区，这将触发预览更新。
  // 对于已有的高亮，这将触发直接的样式更新。
  emit('color-change', newColor, isHighlighted.value)
})

const handleKeydown = (event: KeyboardEvent) => {
  if (!visible.value) return

  // Handle Ctrl+C / Cmd+C for copying original text
  // This should not override the default copy behavior inside the textarea.
  const isPrimaryModifierOnly =
    (isMac ? event.metaKey : event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    (isMac ? !event.ctrlKey : !event.metaKey)

  if (event.key.toLowerCase() === 'c' && isPrimaryModifierOnly) {
    // If the focus is on the textarea, let the default browser behavior handle the copy.
    if (event.target === textareaRef.value) return

    // Otherwise, copy the original highlighted text.
    event.preventDefault()
    event.stopPropagation()
    onCopyClick()
    // If it's a new selection (not an existing highlight), also clear the preview highlight.
    if (!isHighlighted.value) emit('clear-preview')

    hide()
    return // Prevent fall-through
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
    // On Mac, the Option (Alt) key often changes event.key to a special character.
    // For single-letter shortcuts, it's more reliable to check event.code.
    // For example, Option+S on Mac produces event.key: 'ß', but event.code: 'KeyS'.
    const keyMatches =
      isMac && shortcut.alt && shortcut.key.length === 1 && shortcut.key >= 'a' && shortcut.key <= 'z'
        ? event.code.toLowerCase() === `key${shortcut.key}`
        : event.key.toLowerCase() === shortcut.key

    if (!keyMatches) return false
    if (event.altKey !== shortcut.alt) return false
    if (event.shiftKey !== shortcut.shift) return false

    // - 'meta' in settings maps to Command key (event.metaKey) on Mac.
    // - 'ctrl' in settings maps to Control key (event.ctrlKey) on all platforms.
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

/**
 * 显示工具提示，并根据屏幕边界自动调整位置。
 */
function show(
  x: number,
  y: number,
  highlighted: boolean,
  initialNote = '',
  initialColor: string | undefined,
  initialTextToCopy = ''
) {
  zIndex.value = getMaxZIndex()

  // 工具提示的预估尺寸，用于边界检测
  const tooltipWidth = 300
  const tooltipHeight = 160
  const margin = 10

  // 确保工具提示不会超出窗口右侧
  if (x + tooltipWidth > window.innerWidth) x = window.innerWidth - tooltipWidth - margin

  // 确保工具提示不会超出窗口底部
  if (y + tooltipHeight > window.innerHeight) y = window.innerHeight - tooltipHeight - margin

  // 确保工具提示不会超出窗口左侧或顶部
  if (x < margin) x = margin
  if (y < margin) y = margin

  position.x = x
  position.y = y
  isHighlighted.value = highlighted
  noteValue.value = initialNote
  selectedColor.value = initialColor || defaultHighlightColor.value
  textToCopy.value = initialTextToCopy

  visible.value = true

  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function hide() {
  visible.value = false
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true)
})

// Expose functions to the parent component
defineExpose({ show, hide })
</script>

<style scoped></style>
