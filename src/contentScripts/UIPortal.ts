import { createApp, h } from 'vue'
import type { AppState, IUIPortal } from './types'
import Tooltip from './views/Tooltip.vue'
import DisambiguationModal from './views/DisambiguationModal.vue'
import { getMaxZIndex } from '~/logic/dom'
import type { Candidate } from '~/logic/search'

export interface UIPortalActions {
  onSave: (note: string, color: string) => Promise<void>
  onDelete: () => Promise<void>
  onColorChange: (color: string, isExisting: boolean) => void
  onClearPreview: () => void
  onConfirmResolution: (selections: any[]) => Promise<void>
  onDiscardMark: (markId: string) => Promise<void>
  onCandidateHover: (item: Candidate) => Promise<void>
  onCandidateLeave: () => void
}

export class UIPortal implements IUIPortal {
  private tooltipApp: any = null

  constructor(private state: AppState, private actions: UIPortalActions) {}

  mount() {
    const container = document.createElement('div')
    container.id = __NAME__
    container.style.position = 'fixed'
    container.style.zIndex = `${getMaxZIndex() + 1}`

    const shadowDOM = container.attachShadow?.({ mode: 'open' }) || container
    const styleEl = document.createElement('link')
    styleEl.setAttribute('rel', 'stylesheet')
    styleEl.setAttribute('href', browser.runtime.getURL('dist/contentScripts/style.css'))
    shadowDOM.appendChild(styleEl)

    const uiRoot = document.createElement('div')
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) uiRoot.classList.add('dark')
    shadowDOM.appendChild(uiRoot)

    // 1. Mount Tooltip
    const tooltipRoot = document.createElement('div')
    uiRoot.appendChild(tooltipRoot)
    this.tooltipApp = createApp(Tooltip, {
      onSave: this.actions.onSave,
      onDelete: this.actions.onDelete,
      onColorChange: this.actions.onColorChange,
      onClearPreview: this.actions.onClearPreview
    }).mount(tooltipRoot)

    // 2. Mount DisambiguationModal
    const modalRoot = document.createElement('div')
    uiRoot.appendChild(modalRoot)
    createApp({
      render: () =>
        h(DisambiguationModal, {
          ambiguousMarksData: this.state.ambiguousMarks,
          modelValue: this.state.ambiguousMarks.length > 0,
          'onUpdate:modelValue': (val: boolean) => {
            if (!val) this.state.ambiguousMarks = []
          },
          onConfirmResolution: this.actions.onConfirmResolution,
          onDiscardMark: this.actions.onDiscardMark,
          onCancel: () => {
            this.state.ambiguousMarks = []
          },
          'onHover-list-item': this.actions.onCandidateHover,
          'onLeave-list-item': this.actions.onCandidateLeave
        })
    }).mount(modalRoot)

    document.body.appendChild(container)
  }

  showTooltip(x: number, y: number, isHighlighted: boolean, note: string, color: string | undefined, textToCopy: string) {
    this.tooltipApp?.show(x, y, isHighlighted, note, color, textToCopy)
  }

  hideTooltip() {
    this.tooltipApp?.hide()
  }

  showDisambiguation(marks: Candidate[]) {
    this.state.ambiguousMarks = marks
  }
}
