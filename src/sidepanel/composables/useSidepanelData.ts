import { onMounted, onUnmounted, ref, watch } from 'vue'
import { sendMessage } from 'webext-bridge/options'
import browser from 'webextension-polyfill'
import { marksByUrl, tagsMetadata } from '~/logic/storage'
import { type TagTree, buildTagTree } from '~/logic/tagTree'

export function useSidepanelData() {
  const structuredMarks = ref<TagTree>({ inbox: { tagName: '收集箱 (Inbox)', totalMarks: 0, pages: {} } })
  const isSidepanelActive = ref(true)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  async function refreshAllMarks() {
    const allMarks = await sendMessage('get-all-marks', {}, 'background')
    if (allMarks)
      marksByUrl.value = allMarks
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
    refreshAllMarks,
  }
}
