<script setup lang="ts">
defineProps<{
  newTagName: string
}>()

const emit = defineEmits<{
  (e: 'update:newTagName', value: string): void
  (e: 'create-tag'): void
  (e: 'open-options'): void
}>()
</script>

<template>
  <header class="sticky top-0 z-40">
    <h1 class="text-xl font-bold text-center text-gray-800 dark:text-gray-200 mt-4 mb-2">
      标记管理
    </h1>

    <div class="px-2">
      <div
        class="flex gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"
      >
        <input
          :value="newTagName"
          placeholder="新建标签..."
          class="border-gray-200 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 flex-1 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
          @input="e => emit('update:newTagName', (e.target as HTMLInputElement).value)"
          @keydown.enter="emit('create-tag')"
        >
        <button
          class="bg-blue-600 hover:bg-blue-700 rounded-md px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors"
          @click="emit('create-tag')"
        >
          创建
        </button>
        <button
          class="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="打开设置"
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
    </div>
  </header>
</template>
