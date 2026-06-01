import { ref } from 'vue'

export function useUIState() {
  const collapsedStates = ref<Record<string, Record<string, boolean>>>({})
  const collapsedUrls = ref<Record<string, boolean>>({})
  const expandedTexts = ref<Set<string>>(new Set())
  const expandedNotes = ref<Set<string>>(new Set())
  const activeMarkMenu = ref<string | null>(null)
  const activeUrlMenu = ref<string | null>(null)
  const activeFolderMenu = ref<string | null>(null)
  const activeGroupMenu = ref<string | null>(null)
  const tagPickerVisible = ref(false)

  function toggleUrlCollapse(url: string) {
    collapsedUrls.value[url] = !collapsedUrls.value[url]
  }

  function closeMenus() {
    activeMarkMenu.value = null
    activeUrlMenu.value = null
    activeFolderMenu.value = null
    activeGroupMenu.value = null
  }

  return {
    collapsedStates,
    collapsedUrls,
    expandedTexts,
    expandedNotes,
    activeMarkMenu,
    activeUrlMenu,
    activeFolderMenu,
    activeGroupMenu,
    tagPickerVisible,
    toggleUrlCollapse,
    closeMenus,
  }
}
