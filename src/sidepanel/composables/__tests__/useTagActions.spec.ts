import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTagActions } from '../useTagActions'

// Mock webextension-polyfill
vi.mock('webextension-polyfill', () => {
  const browser = {
    runtime: {
      lastError: null,
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  }
  return {
    default: browser,
    storage: browser.storage,
    runtime: browser.runtime,
    browser,
  }
})

vi.mock('webext-bridge/options', () => ({
  sendMessage: vi.fn(),
}))

describe('useTagActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default values', () => {
    const { newTagName } = useTagActions()
    expect(newTagName.value).toBe('')
  })

  it('should not create tag if name is empty', async () => {
    const { sendMessage } = await import('webext-bridge/options')
    const { newTagName, createTag } = useTagActions()

    newTagName.value = ''
    await createTag()
    expect(sendMessage).not.toHaveBeenCalled()

    newTagName.value = '   '
    await createTag()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('should create tag and clear input', async () => {
    const { sendMessage } = await import('webext-bridge/options')
    const { newTagName, createTag } = useTagActions()

    newTagName.value = '  New Tag  '
    await createTag()

    expect(sendMessage).toHaveBeenCalledWith('create-tag', { name: 'New Tag' }, 'background')
    expect(newTagName.value).toBe('')
  })

  it('should not rename tag if tagId or name is invalid', async () => {
    const { sendMessage } = await import('webext-bridge/options')
    const { renameTag } = useTagActions()

    await renameTag('', 'New Name')
    expect(sendMessage).not.toHaveBeenCalled()

    await renameTag('tag-1', '')
    expect(sendMessage).not.toHaveBeenCalled()

    await renameTag('tag-1', '   ')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('should rename tag', async () => {
    const { sendMessage } = await import('webext-bridge/options')
    const { renameTag } = useTagActions()

    await renameTag('tag-1', '  Renamed Tag  ')

    expect(sendMessage).toHaveBeenCalledWith('rename-tag', { tagId: 'tag-1', name: 'Renamed Tag' }, 'background')
  })

  it('should not delete tag if tagId is missing', async () => {
    const { sendMessage } = await import('webext-bridge/options')
    const { deleteTag } = useTagActions()

    await deleteTag('')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('should delete tag', async () => {
    const { sendMessage } = await import('webext-bridge/options')
    const { deleteTag } = useTagActions()

    await deleteTag('tag-1')

    expect(sendMessage).toHaveBeenCalledWith('delete-tag', { tagId: 'tag-1' }, 'background')
  })
})
