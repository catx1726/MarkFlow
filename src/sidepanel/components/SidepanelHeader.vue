<script setup lang="ts">
import { t } from '~/logic/i18n'
import { Z_LAYERS } from '~/logic/layers'

defineProps<{
  newTagName: string
  isCreatingTag: boolean
  searchQuery: string
  compactMode: boolean
}>()

const emit = defineEmits<{
  (e: 'update:newTagName', value: string): void
  (e: 'create-tag'): void
  (e: 'open-options'): void
  (e: 'update:searchQuery', value: string): void
  (e: 'update:compactMode', value: boolean): void
  (e: 'clearSearch'): void
  (e: 'startCreatingTag'): void
  (e: 'cancelCreatingTag'): void
}>()

function onClearSearch() {
  emit('clearSearch')
}
</script>

<template>
  <!-- sticky top-0 + pt-4：顶部间距由 header 自身 padding 提供（背景同步覆盖），
       吸顶位置=初始位置，无跳变；滚动内容不会从 header 上方穿透 -->
  <header class="sticky top-0 bg-neutral-100 dark:bg-neutral-900 pt-4 pb-2" :style="{ zIndex: Z_LAYERS.stickyHeader }">
    <h1 class="text-xl font-bold text-center text-neutral-800 dark:text-neutral-200 mb-2">
      {{ t('sidepanel.title') }}
    </h1>

    <div class="space-y-2">
      <div
        class="flex gap-2 bg-white dark:bg-neutral-800 p-2 rounded-md border border-neutral-200 dark:border-neutral-700"
      >
        <div class="relative flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            :value="searchQuery"
            type="search"
            :placeholder="t('sidepanel.searchPlaceholder')"
            class="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border border-neutral-200 dark:bg-neutral-700 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
            @input="e => emit('update:searchQuery', (e.target as HTMLInputElement).value)"
          >
        </div>

        <button
          class="p-1.5 rounded-md transition-colors"
          :class="isCreatingTag ? 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700'"
          :title="t('sidepanel.newTag')"
          @click="emit(isCreatingTag ? 'cancelCreatingTag' : 'startCreatingTag')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <button
          class="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          :title="t('sidepanel.openSettings')"
          @click="emit('open-options')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      <div
        v-if="isCreatingTag"
        class="flex gap-2 bg-white dark:bg-neutral-800 p-2 rounded-md border border-neutral-200 dark:border-neutral-700"
      >
        <input
          :value="newTagName"
          :placeholder="t('sidepanel.newTagPlaceholder')"
          class="border-neutral-200 dark:bg-neutral-700 dark:border-neutral-600 focus:ring-amber-500 flex-1 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
          @input="e => emit('update:newTagName', (e.target as HTMLInputElement).value)"
          @keydown.enter="emit('create-tag')"
          @keydown.esc="emit('cancelCreatingTag')"
        >
        <button
          class="bg-amber-500 hover:bg-amber-600 rounded-md px-4 py-1.5 text-sm font-medium text-neutral-900 transition-colors"
          @click="emit('create-tag')"
        >
          {{ t('common.create') }}
        </button>
      </div>
      <div
        v-if="searchQuery.trim()"
        class="flex items-center justify-between px-2 py-1"
      >
        <label class="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
          <input
            type="checkbox"
            :checked="compactMode"
            class="h-3.5 w-3.5 rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
            @change="e => emit('update:compactMode', (e.target as HTMLInputElement).checked)"
          >
          {{ t('sidepanel.showMatchesOnly') }}
        </label>
        <button
          class="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          @click="onClearSearch"
        >
          {{ t('sidepanel.clearSearch') }}
        </button>
      </div>
    </div>
  </header>
</template>
