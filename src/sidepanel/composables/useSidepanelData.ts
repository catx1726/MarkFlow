import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { sendMessage } from 'webext-bridge/options'
import browser from 'webextension-polyfill'
import { filterTagTree } from './searchFilter'
import { marksByUrl, tagsMetadata } from '~/logic/storage'
import { type TagTree, buildTagTree } from '~/logic/tagTree'
import { t } from '~/logic/i18n'

export function useSidepanelData() {
  const structuredMarks = ref<TagTree>({ inbox: { tagName: t('common.inbox'), totalMarks: 0, pages: {} } })
  const searchQuery = ref('')
  const debouncedSearchQuery = ref('')
  const compactMode = ref(false)
  const isSidepanelActive = ref(true)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  async function refreshAllMarks() {
    const allMarks = await sendMessage('get-all-marks', {}, 'background')
    if (allMarks)
      marksByUrl.value = allMarks
  }

  // 防抖：用户输入 150ms 后才更新用于过滤的稳定查询值
  const debouncedUpdateQuery = useDebounceFn((value: string) => {
    debouncedSearchQuery.value = value
  }, 150)

  watch(searchQuery, (newValue) => {
    debouncedUpdateQuery(newValue)
  })

  const filteredTree = computed(() =>
    filterTagTree(structuredMarks.value, debouncedSearchQuery.value, compactMode.value),
  )

  function clearSearch() {
    searchQuery.value = ''
    debouncedSearchQuery.value = ''
    compactMode.value = false
  }

  const refreshListener = (message: any) => {
    if (message && message.type === 'refresh-sidepanel-data')
      refreshAllMarks()
  }

  watch([marksByUrl, tagsMetadata], () => {
    if (!isSidepanelActive.value)
      return
    if (debounceTimer)
      clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (!isSidepanelActive.value)
        return
      structuredMarks.value = buildTagTree(marksByUrl.value, tagsMetadata.value)
    }, 50)
  }, { deep: true, immediate: true, flush: 'post' })

  onMounted(() => {
    browser.runtime.onMessage.addListener(refreshListener)
  })

  onUnmounted(() => {
    isSidepanelActive.value = false
    if (debounceTimer)
      clearTimeout(debounceTimer)
    browser.runtime.onMessage.removeListener(refreshListener)
  })

  return {
    structuredMarks,
    searchQuery,
    debouncedSearchQuery,
    compactMode,
    clearSearch,
    filteredTree,
    refreshAllMarks,
  }
}
