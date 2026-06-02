<script setup lang="ts">
import { CLEANUP_DAYS_THRESHOLD } from '~/logic/config'

defineProps<{
  storageUsage: number
  storageQuota: number
  storageUsagePercent: number
}>()

const emit = defineEmits<{
  (e: 'cleanup-old'): void
  (e: 'cleanup-useless'): void
}>()
</script>

<template>
  <div
    class="border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 fixed bottom-0 left-0 right-0 z-10 w-full border-t p-[16px] shadow-lg backdrop-blur-sm"
  >
    <h2 class="text-gray-700 dark:text-gray-200 mb-[8px] text-[18px] font-semibold">
      存储管理
    </h2>
    <div class="text-gray-600 dark:text-gray-400 text-[14px]">
      <p>
        已用空间: {{ (storageUsage / 1024).toFixed(2) }} KB /
        <span v-if="storageQuota">{{ (storageQuota / 1024 / 1024).toFixed(2) }} MB</span>
        <span v-else>无已知限制</span>
      </p>
      <div class="bg-gray-200 dark:bg-gray-700 mt-[4px] h-[10px] w-full rounded-full">
        <div class="bg-blue-600 h-[10px] rounded-full" :style="{ width: `${storageUsagePercent}%` }" />
      </div>
    </div>
    <div class="mt-[16px] flex gap-[8px]">
      <button
        class="action-button bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900 rounded-md px-[12px] py-[4px] text-[14px] font-medium"
        @click="emit('cleanup-old')"
      >
        清理 {{ CLEANUP_DAYS_THRESHOLD }} 天前的标记
      </button>
      <button
        class="action-button bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-400 dark:hover:bg-yellow-900 rounded-md px-[12px] py-[4px] text-[14px] font-medium"
        @click="emit('cleanup-useless')"
      >
        清理无备注的标记
      </button>
    </div>
  </div>
</template>
