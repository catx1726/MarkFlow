import { reactive, ref } from 'vue'
import type { Candidate } from '~/logic/search'

export interface TooltipInstance {
  show: (x: number, y: number, isHighlighted: boolean, note: string, color: string | undefined, textToCopy: string) => void
  hide: () => void
}

export interface DisambiguationModalInstance {
  show: (marks: Candidate[]) => void
  hide: () => void
}

const COOLDOWN_DURATION = 3000

export class HighlightStateManager {
  restoredMarkIds = new Set<string>()
  failedRestoreCooldowns = new Map<string, number>()
  ambiguousMarksQueue = ref<Candidate[]>([])
  modalState = reactive({ marks: [] as Candidate[], visible: false })
  isRestoring = false
  tooltipApp: TooltipInstance | null = null
  disambiguationModalApp: DisambiguationModalInstance | null = null
  currentSerializationRoot: Node | undefined
  serializedSelection: string | null = null
  currentMarkIdForColorChange: string | null = null
  originalColorForChange: string | null = null
  previewApplier: any = null

  isRestored(id: string): boolean {
    return this.restoredMarkIds.has(id)
  }

  markRestored(id: string): void {
    this.restoredMarkIds.add(id)
    this.failedRestoreCooldowns.delete(id)
  }

  markFailed(id: string): void {
    this.failedRestoreCooldowns.set(id, Date.now() + COOLDOWN_DURATION)
  }

  isOnCooldown(id: string): boolean {
    const cooldown = this.failedRestoreCooldowns.get(id)
    return cooldown !== undefined && Date.now() < cooldown
  }

  clearCooldown(id: string): void {
    this.failedRestoreCooldowns.delete(id)
  }

  deleteRestored(id: string): void {
    this.restoredMarkIds.delete(id)
  }

  canRestore(id: string): boolean {
    return !this.isRestored(id) && !this.isOnCooldown(id)
  }

  addToAmbiguousQueue(candidates: Candidate[]): void {
    const existingIds = new Set(this.ambiguousMarksQueue.value.map(m => m.originalMarkId))
    const newCandidates = candidates.filter(c => !existingIds.has(c.originalMarkId))
    this.ambiguousMarksQueue.value = [...this.ambiguousMarksQueue.value, ...newCandidates]
  }

  removeFromAmbiguousQueue(markId: string): void {
    this.ambiguousMarksQueue.value = this.ambiguousMarksQueue.value.filter(m => m.originalMarkId !== markId)
    // 如果队列清空且弹窗已显示，自动关闭弹窗
    if (this.ambiguousMarksQueue.value.length === 0 && this.modalState.visible) {
      this.modalState.visible = false
    }
  }

  clearSelectionState(): void {
    this.currentSerializationRoot = undefined
    this.serializedSelection = null
    this.currentMarkIdForColorChange = null
    this.originalColorForChange = null
  }

  clearAll(): void {
    this.restoredMarkIds.clear()
    this.failedRestoreCooldowns.clear()
    this.ambiguousMarksQueue.value = []
    this.modalState.marks = []
    this.modalState.visible = false
    this.isRestoring = false
    this.tooltipApp = null
    this.disambiguationModalApp = null
    this.currentSerializationRoot = undefined
    this.serializedSelection = null
    this.currentMarkIdForColorChange = null
    this.originalColorForChange = null
    this.previewApplier = null
  }
}
