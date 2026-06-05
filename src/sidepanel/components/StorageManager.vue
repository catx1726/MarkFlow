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
}>()

const isExpanded = ref(false)

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
  <transition name="slide-up" mode="out-in">
    <!-- 折叠状态：极简进度条 + 展开按钮 -->
    <div
      v-if="!isExpanded"
      key="collapsed"
      class="fixed bottom-0 left-0 right-0 z-10 bg-white/80 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm px-3 py-2 flex items-center gap-3"
    >
      <!-- 数据库图标，标识这是存储管理 -->
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

      <div class="flex-1 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="barColorClass"
          :style="{ width: `${storageUsagePercent}%` }"
        />
      </div>

      <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">
        {{ storageUsagePercent.toFixed(0) }}%
      </span>

      <button
        class="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        title="展开存储管理"
        @click="isExpanded = true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <!-- 展开状态：完整面板 -->
    <div
      v-else
      key="expanded"
      class="fixed bottom-0 left-0 right-0 z-10 w-full border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 p-4 shadow-lg backdrop-blur-sm"
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-gray-500 dark:text-gray-400"
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
          <h2 class="text-gray-700 dark:text-gray-200 text-base font-semibold">
            存储管理
          </h2>
        </div>
        <button
          class="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          title="收起"
          @click="isExpanded = false"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <div class="text-gray-600 dark:text-gray-400 text-sm">
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
  </transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
