<script setup lang="ts">
import { type Candidate } from '~/logic/search'

const props = defineProps<{
  item: Candidate
  isSelected: boolean
  isHovered: boolean
}>()

const emit = defineEmits<{
  (e: 'hoverListItem', item: Candidate): void
  (e: 'leaveListItem', item: Candidate): void
  (e: 'selectListItem', item: Candidate): void
}>()
</script>

<template>
  <div
    class="p-3 border border-gray-200 rounded mb-2 cursor-pointer transition-colors"
    :class="{ 
      'border-blue-500 bg-blue-50': isSelected, 
      'border-orange-400 bg-orange-50': isHovered && !isSelected 
    }"
    @mouseover="emit('hoverListItem', item)"
    @mouseleave="emit('leaveListItem', item)"
    @click="emit('selectListItem', item)"
  >
    <div v-if="item.displayTitle" class="text-xs text-gray-500 mb-1 uppercase tracking-wider">
      {{ item.displayTitle }}
    </div>
    <div class="text-sm text-gray-700 italic mb-1 line-clamp-2">
      "...{{ item.displayContext }}..."
    </div>
    <div class="text-base font-bold text-gray-900">
      {{ item.displayTextSnippet }}
    </div>
  </div>
</template>
