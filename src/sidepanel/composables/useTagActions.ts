import { ref, toRaw } from 'vue'
import { sendMessage } from 'webext-bridge/options'
import { marksByUrl, tagsMetadata } from '~/logic/storage'

export function useTagActions() {
  const newTagName = ref('')
  const tagPickerUrl = ref<string | null>(null)
  const tagPickerMarkId = ref<string | null>(null)
  const tagPickerVisible = ref(false)

  const editingTagId = ref<string | null>(null)
  const editingTagName = ref('')
  const renameDialogVisible = ref(false)

  async function createTag() {
    if (!newTagName.value.trim())
      return
    await sendMessage('create-tag', { name: newTagName.value.trim() }, 'background')
    newTagName.value = ''
  }

  function openRenameDialog(tagId: string) {
    editingTagId.value = tagId
    editingTagName.value = tagsMetadata.value[tagId]?.name || ''
    renameDialogVisible.value = true
  }

  async function confirmRename() {
    if (editingTagId.value && editingTagName.value.trim()) {
      await sendMessage('rename-tag', { tagId: editingTagId.value, name: editingTagName.value.trim() }, 'background')
    }
    cancelRename()
  }

  function cancelRename() {
    renameDialogVisible.value = false
    editingTagId.value = null
    editingTagName.value = ''
  }

  async function renameTag(tagId: string, newName: string) {
    if (!tagId || !newName.trim())
      return
    await sendMessage('rename-tag', { tagId, name: newName.trim() }, 'background')
  }

  async function deleteTag(tagId: string) {
    if (!tagId)
      return
    await sendMessage('delete-tag', { tagId }, 'background')
  }

  function openTagPicker(url: string, markId: string | null = null) {
    tagPickerUrl.value = url
    tagPickerMarkId.value = markId
    tagPickerVisible.value = true
  }

  function closeTagPicker() {
    tagPickerVisible.value = false
    tagPickerUrl.value = null
    tagPickerMarkId.value = null
  }

  async function togglePageTag(tagId: string) {
    const currentUrl = tagPickerUrl.value
    if (!currentUrl)
      return

    const marksSnapshot = toRaw(marksByUrl.value[currentUrl])
    if (!marksSnapshot)
      return

    const updatePromises: Promise<any>[] = []

    if (tagPickerMarkId.value) {
      const m = marksSnapshot.find(m => m.id === tagPickerMarkId.value)
      if (!m)
        return
      const tags = m.tags || []
      const idx = tags.indexOf(tagId)
      const newTags = idx >= 0 ? tags.filter(t => t !== tagId) : [...tags, tagId]
      updatePromises.push(sendMessage('update-mark-details', { id: m.id, url: m.url, tags: newTags }, 'background'))
    }
    else {
      marksSnapshot.forEach((m) => {
        const tags = m.tags || []
        const idx = tags.indexOf(tagId)
        const newTags = idx >= 0 ? tags.filter(t => t !== tagId) : [...tags, tagId]
        updatePromises.push(sendMessage('update-mark-details', { id: m.id, url: m.url, tags: newTags }, 'background'))
      })
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises)
    }
  }

  function isPageTagChecked(tagId: string): boolean {
    if (!tagPickerUrl.value)
      return false
    const marks = marksByUrl.value[tagPickerUrl.value]
    if (!marks || marks.length === 0)
      return false
    if (tagPickerMarkId.value)
      return marks.some(m => m.id === tagPickerMarkId.value && (m.tags || []).includes(tagId))
    return marks.some(m => (m.tags || []).includes(tagId))
  }

  return {
    newTagName,
    tagPickerUrl,
    tagPickerMarkId,
    tagPickerVisible,
    editingTagId,
    editingTagName,
    renameDialogVisible,
    createTag,
    renameTag,
    deleteTag,
    togglePageTag,
    isPageTagChecked,
    openTagPicker,
    closeTagPicker,
    openRenameDialog,
    confirmRename,
    cancelRename,
  }
}
