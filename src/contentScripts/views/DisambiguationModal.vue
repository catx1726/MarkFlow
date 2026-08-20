<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ListItemComponent from './ListItemComponent.vue'
import type { Candidate } from '~/logic/search'
import { t } from '~/logic/i18n'

const props = defineProps<{
  ambiguousMarksData: Candidate[]
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (
    e: 'confirmResolution',
    selections: { originalMarkId: string, candidateElement: HTMLElement, actualText: string, matchIndex: number }[]
  ): void
  (e: 'discardMark', markId: string): void
  (e: 'cancel'): void
  (e: 'hoverListItem', item: Candidate): void
  (e: 'leaveListItem', item: Candidate): void
}>()

const searchTerm = ref('')
const selectedCandidateIds = ref<Set<string>>(new Set()) // Format: "candidateId"
const hoveredCandidateId = ref<string | null>(null)

const filteredMarks = computed(() => {
  if (!searchTerm.value)
    return props.ambiguousMarksData
  const term = searchTerm.value.toLowerCase()
  return props.ambiguousMarksData.filter(
    m =>
      m.displayTextSnippet.toLowerCase().includes(term)
      || m.displayContext.toLowerCase().includes(term)
      || (m.displayTitle && m.displayTitle.toLowerCase().includes(term)),
  )
})

const groupedMarks = computed(() => {
  const groups: Record<string, { text: string, items: Candidate[] }> = {}
  filteredMarks.value.forEach((m) => {
    if (!groups[m.originalMarkId]) {
      groups[m.originalMarkId] = {
        text: m.originalMarkText,
        items: [],
      }
    }
    groups[m.originalMarkId].items.push(m)
  })
  return groups
})

function handleItemHover(item: Candidate) {
  hoveredCandidateId.value = item.id
  emit('hoverListItem', item)
}

function handleItemLeave(item: Candidate) {
  if (hoveredCandidateId.value === item.id) {
    hoveredCandidateId.value = null
  }
  emit('leaveListItem', item)
}

function handleItemClick(item: Candidate) {
  // 同一 markId 只能选一个
  for (const id of Array.from(selectedCandidateIds.value)) {
    const candidate = props.ambiguousMarksData.find(c => c.id === id)
    if (candidate && candidate.originalMarkId === item.originalMarkId) {
      selectedCandidateIds.value.delete(id)
    }
  }
  selectedCandidateIds.value.add(item.id)
}

function handleConfirm() {
  const results = Array.from(selectedCandidateIds.value).map((id) => {
    const candidate = props.ambiguousMarksData.find(c => c.id === id)
    return {
      originalMarkId: candidate!.originalMarkId,
      candidateElement: candidate!.candidateElement,
      actualText: candidate!.displayTextSnippet,
      matchIndex: candidate!.matchIndex,
    }
  })
  emit('confirmResolution', results)
  emit('update:modelValue', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (val) => {
    if (!val) {
      searchTerm.value = ''
      selectedCandidateIds.value.clear()
      hoveredCandidateId.value = null
    }
  },
)
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-10000 flex items-center justify-center bg-black/50 font-sans">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <h2 class="text-lg font-bold text-gray-800 dark:text-gray-200">
          {{ t('modal.title') }}
        </h2>
        <button class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" @click="handleCancel">
          <div i-carbon-close class="text-2xl" />
        </button>
      </div>

      <!-- Search -->
      <div class="p-4 border-b border-gray-50 dark:border-gray-700">
        <div class="relative">
          <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            <div i-carbon-search />
          </div>
          <input
            v-model="searchTerm"
            type="text"
            :placeholder="t('modal.searchPlaceholder')"
            class="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          >
        </div>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div v-for="(group, markId) in groupedMarks" :key="markId" class="mb-8">
          <div class="flex items-center justify-between mb-4 pb-2 border-b border-amber-100 dark:border-amber-900/30">
            <div class="flex items-center gap-2">
              <div class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold rounded flex-shrink-0">
                {{ t('modal.locating') }}
              </div>
              <span class="text-sm font-bold text-gray-700 dark:text-gray-200">“{{ group.text }}”</span>
            </div>
            <button
              class="flex flex-shrink-0 items-center gap-1 text-xs text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              :title="t('modal.discardTitle')"
              @click="emit('discardMark', markId as string)"
            >
              <div i-carbon-trash-can />
              {{ t('modal.discard') }}
            </button>
          </div>
          <ListItemComponent
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            :is-selected="selectedCandidateIds.has(item.id)"
            :is-hovered="hoveredCandidateId === item.id"
            @hover-list-item="handleItemHover"
            @leave-list-item="handleItemLeave"
            @select-list-item="handleItemClick"
          />
        </div>
        <div v-if="Object.keys(groupedMarks).length === 0" class="text-center py-10 text-gray-400 dark:text-gray-500">
          {{ t('modal.noMatches') }}
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
        <button class="px-4 py-2 text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700 rounded transition-colors" @click="handleCancel">
          {{ t('common.cancel') }}
        </button>
        <button
          :disabled="selectedCandidateIds.size === 0"
          class="px-6 py-2 bg-amber-500 text-gray-900 rounded font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          @click="handleConfirm"
        >
          {{ t('modal.confirmRestore', { count: selectedCandidateIds.size }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--component-scrollbar-thumb);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--component-scrollbar-thumb-hover);
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--component-scrollbar-thumb);
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--component-scrollbar-thumb-hover);
}
</style>
