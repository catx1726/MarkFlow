<script setup lang="ts">
import { computed, ref } from 'vue'
import { CLEANUP_DAYS_THRESHOLD } from '~/logic/config'

const props = defineProps<{
  storageUsage: number
  storageQuota: number
  storageUsagePercent: number
}>()

const emit = defineEmits<{
  (e: 'cleanup-old'): void
  (e: 'cleanup-useless'): void
  (e: 'update:expanded', value: boolean): void
}>()

const isExpanded = ref(false)

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
  emit('update:expanded', isExpanded.value)
}

const barColorClass = computed(() => {
  const p = props.storageUsagePercent
  if (p >= 80)
    return 'bg-red-500'
  if (p >= 50)
    return 'bg-yellow-500'
  return 'bg-blue-600'
})
</script>

<template>
  <div
    class="fixed bottom-0 left-0 right-0 z-10 bg-white/80 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm transition-all duration-200 ease-in-out"
    :class="isExpanded ? 'p-4 shadow-lg' : 'px-3 py-2'"
  >
    <!-- 始终可见的头部行 -->
    <div class="flex items-center gap-3">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>

      <!-- 中间区域始终占满，防止按钮位置跳动 -->
      <div class="flex-1 min-w-0">
        <div v-if="!isExpanded" class="flex items-center gap-2">
          <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden h-1.5">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="barColorClass"
              :style="{ width: `${storageUsagePercent}%` }"
            />
          </div>
          <span class="text-xs text-gray-500 dark:text-gray-400 font-medium flex-shrink-0">
            {{ storageUsagePercent.toFixed(0) }}%
          </span>
        </div>
        <div v-else class="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
          存储空间
        </div>
      </div>

      <button
        class="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex-shrink-0"
        :title="isExpanded ? '收起' : '展开存储管理'"
        @click="toggleExpanded"
      >
        <svg
          v-if="!isExpanded"
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
            clip-rule="evenodd"
          />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <!-- 可折叠内容：CSS Grid 高度坍塌动画 -->
    <div
      class="grid transition-[grid-template-rows] duration-200 ease-in-out"
      :class="isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    >
      <div class="overflow-hidden">
        <div class="mt-2 text-gray-600 dark:text-gray-400 text-sm">
          <p>
            已用空间: {{ (storageUsage / 1024).toFixed(2) }} KB /
            <span v-if="storageQuota">{{ (storageQuota / 1024 / 1024).toFixed(2) }} MB</span>
            <span v-else>无已知限制</span>
          </p>
          <div class="bg-gray-200 dark:bg-gray-700 mt-1 h-2 w-full rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="barColorClass"
              :style="{ width: `${storageUsagePercent}%` }"
            />
          </div>
        </div>

        <div class="mt-3 flex gap-2">
          <button
            class="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900 rounded-md px-3 py-1 text-sm font-medium transition-colors"
            @click="emit('cleanup-old')"
          >
            清理 {{ CLEANUP_DAYS_THRESHOLD }} 天前的标记
          </button>
          <button
            class="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-400 dark:hover:bg-yellow-900 rounded-md px-3 py-1 text-sm font-medium transition-colors"
            @click="emit('cleanup-useless')"
          >
            清理无备注的标记
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
