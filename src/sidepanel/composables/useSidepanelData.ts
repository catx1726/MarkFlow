import { onUnmounted, ref, watch } from 'vue'
import { marksByUrl, tagsMetadata } from '~/logic/storage'
import { type TagTree, buildTagTree } from '~/logic/tagTree'

export function useSidepanelData() {
  const structuredMarks = ref<TagTree>({ inbox: { tagName: '收集箱 (Inbox)', totalMarks: 0, pages: {} } })
  const isSidepanelActive = ref(true)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

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

  onUnmounted(() => {
    isSidepanelActive.value = false
    if (debounceTimer)
      clearTimeout(debounceTimer)
  })

  return { structuredMarks }
}
