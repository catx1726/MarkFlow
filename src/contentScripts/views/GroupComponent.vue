<script setup lang="ts">
import { type Candidate } from '~/logic/search'
import ListItemComponent from './ListItemComponent.vue'

const props = defineProps<{
  groupTitle: string
  items: Candidate[]
  selectedMarkIds: Set<string>
  hoveredElement: HTMLElement | null
}>()

const emit = defineEmits<{
  (e: 'hoverListItem', item: Candidate): void
  (e: 'leaveListItem', item: Candidate): void
  (e: 'selectListItem', item: Candidate): void
}>()
</script>

<template>
  <div class="mb-6">
    <h3 class="text-sm font-semibold text-gray-600 mb-3 pb-1 border-b border-gray-100">
      {{ groupTitle }}
    </h3>
    <ListItemComponent
      v-for="(item, index) in items"
      :key="item.id"
      :item="item"
      :is-selected="selectedMarkIds.has(item.id)"
      :is-hovered="hoveredElement === item.candidateElement"
      @hover-list-item="emit('hoverListItem', item)"
      @leave-list-item="emit('leaveListItem', item)"
      @select-list-item="emit('selectListItem', item)"
    />
  </div>
</template>
