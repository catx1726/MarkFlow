import { computed, ref } from 'vue'
import { sendMessage } from 'webext-bridge/options'
import { CLEANUP_DAYS_THRESHOLD } from '~/logic/config'

export function useStorageMonitor() {
  const storageUsage = ref(0)
  const storageQuota = ref(0)

  const storageUsagePercent = computed(() => {
    if (!storageQuota.value)
      return 0
    return (storageUsage.value / storageQuota.value) * 100
  })

  async function refreshUsage() {
    const response = await sendMessage('get-storage-usage', undefined, 'background')
    if (response) {
      storageUsage.value = (response as any).usage || 0
      storageQuota.value = (response as any).quota || 0
    }
  }

  async function cleanupOldMarks() {
    // eslint-disable-next-line no-alert
    if (confirm(`确定要清理 ${CLEANUP_DAYS_THRESHOLD} 天前的所有标记吗？此操作不可撤销。`)) {
      await sendMessage('cleanup-old-marks', { days: CLEANUP_DAYS_THRESHOLD }, 'background')
      await refreshUsage()
      return true
    }
    return false
  }

  async function cleanupUselessMarks() {
    // eslint-disable-next-line no-alert
    if (confirm('确定要清理所有没有备注的标记吗？此操作不可撤销。')) {
      await sendMessage('cleanup-useless-marks', undefined, 'background')
      await refreshUsage()
      return true
    }
    return false
  }

  return {
    storageUsage,
    storageQuota,
    storageUsagePercent,
    refreshUsage,
    cleanupOldMarks,
    cleanupUselessMarks,
  }
}
