import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useSidepanelData } from '../useSidepanelData'
import { marksByUrl, tagsMetadata } from '~/logic/storage'

// Mock storage
vi.mock('~/logic/storage', () => ({
  marksByUrl: { value: {} },
  tagsMetadata: { value: {} },
}))

// Mock buildTagTree
vi.mock('~/logic/tagTree', () => ({
  buildTagTree: vi.fn(() => ({ mocked: true, count: 1 })),
}))

describe('useSidepanelData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    marksByUrl.value = {}
    tagsMetadata.value = {}
  })

  it('should initialize with default structure', () => {
    const { structuredMarks } = useSidepanelData()
    expect(structuredMarks.value).toHaveProperty('inbox')
  })

  it('should update structuredMarks when storage changes (debounced)', async () => {
    const { structuredMarks } = useSidepanelData()

    // Simulate storage update
    marksByUrl.value = { url1: [] }
    await nextTick()

    // Should not update immediately due to debounce
    expect(structuredMarks.value).not.toHaveProperty('mocked')

    // Fast-forward time
    vi.advanceTimersByTime(50)
    await nextTick()

    expect(structuredMarks.value).toEqual({ mocked: true, count: 1 })
  })
})
