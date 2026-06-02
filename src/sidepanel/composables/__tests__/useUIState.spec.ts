import { describe, expect, it } from 'vitest'
import { useUIState } from '../useUIState'

describe('useUIState', () => {
  it('should initialize with default values', () => {
    const {
      collapsedStates,
      collapsedUrls,
      expandedTexts,
      expandedNotes,
      activeMarkMenu,
      activeUrlMenu,
      activeFolderMenu,
      activeGroupMenu,
      tagPickerVisible,
    } = useUIState()

    expect(collapsedStates.value).toEqual({})
    expect(collapsedUrls.value).toEqual({})
    expect(expandedTexts.value instanceof Set).toBe(true)
    expect(expandedNotes.value instanceof Set).toBe(true)
    expect(activeMarkMenu.value).toBeNull()
    expect(activeUrlMenu.value).toBeNull()
    expect(activeFolderMenu.value).toBeNull()
    expect(activeGroupMenu.value).toBeNull()
    expect(tagPickerVisible.value).toBe(false)
  })

  it('should toggle url collapse', () => {
    const { collapsedUrls, toggleUrlCollapse } = useUIState()
    const url = 'https://example.com'

    expect(collapsedUrls.value[url]).toBeUndefined()
    toggleUrlCollapse(url)
    expect(collapsedUrls.value[url]).toBe(true)
    toggleUrlCollapse(url)
    expect(collapsedUrls.value[url]).toBe(false)
  })

  it('should close all menus', () => {
    const {
      activeMarkMenu,
      activeUrlMenu,
      activeFolderMenu,
      activeGroupMenu,
      closeMenus,
    } = useUIState()

    activeMarkMenu.value = 'mark1'
    activeUrlMenu.value = 'url1'
    activeFolderMenu.value = 'folder1'
    activeGroupMenu.value = 'group1'

    closeMenus()

    expect(activeMarkMenu.value).toBeNull()
    expect(activeUrlMenu.value).toBeNull()
    expect(activeFolderMenu.value).toBeNull()
    expect(activeGroupMenu.value).toBeNull()
  })
})
