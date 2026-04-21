import type { Candidate } from '~/logic/search'

export interface AppState {
  isRestoring: boolean
  ambiguousMarks: Candidate[]
  currentSelection: {
    serialized: string | null
    root: Node | undefined
    text: string
  } | null
  currentMarkIdForColorChange: string | null
}

export interface IRestorationEngine {
  restore(): Promise<void>
  debouncedRestore(): void
}

export interface IInteractionController {
  setupListeners(): void
}

export interface IUIPortal {
  mount(): void
  showTooltip(x: number, y: number, isHighlighted: boolean, note: string, color: string | undefined, textToCopy: string): void
  hideTooltip(): void
  showDisambiguation(marks: Candidate[]): void
}
