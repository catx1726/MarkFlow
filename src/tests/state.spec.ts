import { describe, expect, it } from 'vitest'
import { HighlightStateManager } from '../contentScripts/state'
import type { Candidate } from '~/logic/search'

function makeCandidate(originalMarkId: string, id?: string): Candidate {
  return {
    id: id ?? `${originalMarkId}-candidate`,
    originalMarkId,
    originalMarkText: 'some text',
    candidateElement: document.createElement('div'),
    displayTextSnippet: 'some text',
    displayContext: 'some context',
    surroundingSnippet: 'some surrounding snippet',
    matchIndex: 0,
    matchLength: 10,
  }
}

describe('HighlightStateManager', () => {
  it('should initialize with empty state', () => {
    const state = new HighlightStateManager()
    expect(state.restoredMarkIds.size).toBe(0)
    expect(state.failedRestoreCooldowns.size).toBe(0)
    expect(state.ambiguousMarksQueue.value).toEqual([])
    expect(state.modalState.visible).toBe(false)
    expect(state.modalState.marks).toEqual([])
    expect(state.isRestoring).toBe(false)
    expect(state.tooltipApp).toBeNull()
    expect(state.disambiguationModalApp).toBeNull()
    expect(state.currentSerializationRoot).toBeUndefined()
    expect(state.serializedSelection).toBeNull()
    expect(state.currentMarkIdForColorChange).toBeNull()
    expect(state.originalColorForChange).toBeNull()
  })

  it('should track restored marks', () => {
    const state = new HighlightStateManager()
    expect(state.isRestored('mark-1')).toBe(false)
    state.markRestored('mark-1')
    expect(state.isRestored('mark-1')).toBe(true)
    expect(state.restoredMarkIds.has('mark-1')).toBe(true)
  })

  it('should manage cooldowns', () => {
    const state = new HighlightStateManager()
    expect(state.isOnCooldown('mark-1')).toBe(false)
    state.markFailed('mark-1')
    expect(state.isOnCooldown('mark-1')).toBe(true)
    state.clearCooldown('mark-1')
    expect(state.isOnCooldown('mark-1')).toBe(false)
  })

  it('canRestore should return false when restored', () => {
    const state = new HighlightStateManager()
    state.markRestored('mark-1')
    expect(state.canRestore('mark-1')).toBe(false)
  })

  it('canRestore should return false when on cooldown', () => {
    const state = new HighlightStateManager()
    state.markFailed('mark-1')
    expect(state.canRestore('mark-1')).toBe(false)
  })

  it('canRestore should return true when not restored and not on cooldown', () => {
    const state = new HighlightStateManager()
    expect(state.canRestore('mark-1')).toBe(true)
  })

  it('should deduplicate ambiguous queue by originalMarkId', () => {
    const state = new HighlightStateManager()
    const c1 = makeCandidate('mark-1', 'c1')
    const c2 = makeCandidate('mark-1', 'c2')
    const c3 = makeCandidate('mark-2', 'c3')

    state.addToAmbiguousQueue([c1])
    expect(state.ambiguousMarksQueue.value).toHaveLength(1)

    state.addToAmbiguousQueue([c2])
    expect(state.ambiguousMarksQueue.value).toHaveLength(1)
    expect(state.ambiguousMarksQueue.value[0].id).toBe('c1')

    state.addToAmbiguousQueue([c3])
    expect(state.ambiguousMarksQueue.value).toHaveLength(2)
  })

  it('should clear selection state', () => {
    const state = new HighlightStateManager()
    state.currentSerializationRoot = document.createElement('div')
    state.serializedSelection = 'test'
    state.currentMarkIdForColorChange = 'mark-1'
    state.originalColorForChange = '#ff0000'

    state.clearSelectionState()

    expect(state.currentSerializationRoot).toBeUndefined()
    expect(state.serializedSelection).toBeNull()
    expect(state.currentMarkIdForColorChange).toBeNull()
    expect(state.originalColorForChange).toBeNull()
  })

  it('should clear all state', () => {
    const state = new HighlightStateManager()
    state.markRestored('mark-1')
    state.markFailed('mark-2')
    state.ambiguousMarksQueue.value = [makeCandidate('mark-3')]
    state.modalState.marks = [makeCandidate('mark-3')]
    state.modalState.visible = true
    state.isRestoring = true
    state.currentMarkIdForColorChange = 'mark-1'

    state.clearAll()

    expect(state.restoredMarkIds.size).toBe(0)
    expect(state.failedRestoreCooldowns.size).toBe(0)
    expect(state.ambiguousMarksQueue.value).toEqual([])
    expect(state.modalState.marks).toEqual([])
    expect(state.modalState.visible).toBe(false)
    expect(state.isRestoring).toBe(false)
    expect(state.currentMarkIdForColorChange).toBeNull()
  })

  it('should delete restored mark', () => {
    const state = new HighlightStateManager()
    state.markRestored('mark-1')
    expect(state.isRestored('mark-1')).toBe(true)
    state.deleteRestored('mark-1')
    expect(state.isRestored('mark-1')).toBe(false)
  })
})
