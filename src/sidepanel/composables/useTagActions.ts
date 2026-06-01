import { ref } from 'vue'
import { sendMessage } from 'webext-bridge/options'

export function useTagActions() {
  const newTagName = ref('')

  async function createTag() {
    if (!newTagName.value.trim())
      return
    await sendMessage('create-tag', { name: newTagName.value.trim() }, 'background')
    newTagName.value = ''
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

  return { newTagName, createTag, renameTag, deleteTag }
}
