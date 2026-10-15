import { reactive, ref } from 'vue'
import type { Candidate } from '~/logic/search'
import type { AnchorRect } from '~/logic/tooltipPosition'

export interface TooltipInstance {
  show: (anchorRect: AnchorRect, isHighlighted: boolean, note: string, color: string | undefined, textToCopy: string, tags?: string[], pointer?: { x: number, y: number }) => void
  hide: () => void
}

export interface DisambiguationModalInstance {
  show: (marks: Candidate[]) => void
  hide: () => void
}

const COOLDOWN_DURATION = 3000
/** 连续失败指数退避上限：3s → 6s → 12s → 24s → 30s(封顶) */
const COOLDOWN_MAX_DURATION = 30_000
/** 瞬时失败连续达到此次数后升级为退避冷却（约 5×3s=15s 内 host 未出现） */
const TRANSIENT_FAILURE_ESCALATE_AFTER = 5

export class HighlightStateManager {
  restoredMarkIds = new Set<string>()
  failedRestoreCooldowns = new Map<string, number>()
  private failureStreaks = new Map<string, number>()
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
    this.failureStreaks.delete(id)
  }

  markFailed(id: string): void {
    const streak = (this.failureStreaks.get(id) || 0) + 1
    this.failureStreaks.set(id, streak)
    const backoff = Math.min(COOLDOWN_DURATION * 2 ** (streak - 1), COOLDOWN_MAX_DURATION)
    this.failedRestoreCooldowns.set(id, Date.now() + backoff)
  }

  /**
   * 瞬时失败（如 shadow host 尚未挂载）：固定 3s 冷却且不累积退避。
   * 语义区分（PR #92 CR2/R3 Blocking #1）：结构性未就绪的重试成本极低
   * （querySelector + 2 条消息往返），不应随连续失败退避到 30s。
   * 但 host 缺失也可能是永久性移除（用户删除节点），故连续达到
   * TRANSIENT_FAILURE_ESCALATE_AFTER 次后升级 markFailed 进入退避——
   * 慢挂载 SPA（15s 内）仍享快重试，永久移除则收敛到 30s 兜底。
   */
  markTransientFailure(id: string): void {
    const streak = (this.failureStreaks.get(id) || 0) + 1
    this.failureStreaks.set(id, streak)
    if (streak >= TRANSIENT_FAILURE_ESCALATE_AFTER) {
      this.markFailed(id)
      return
    }
    this.failedRestoreCooldowns.set(id, Date.now() + COOLDOWN_DURATION)
  }

  isOnCooldown(id: string): boolean {
    const cooldown = this.failedRestoreCooldowns.get(id)
    return cooldown !== undefined && Date.now() < cooldown
  }

  clearCooldown(id: string): void {
    this.failedRestoreCooldowns.delete(id)
    this.failureStreaks.delete(id)
  }

  deleteRestored(id: string): void {
    this.restoredMarkIds.delete(id)
    this.failureStreaks.delete(id)
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
    this.failureStreaks.clear()
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
