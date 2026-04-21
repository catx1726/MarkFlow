/**
 * # UI 门户 (UI Portal)
 * 
 * 本模块负责扩展 UI 层的物理隔离与挂载。
 * 核心设计原则：**视图隔离 (View Isolation)**。
 * 
 * 通过 Shadow DOM 确保扩展 UI 不受页面 CSS 污染，同时管理 Vue 组件的生命周期。
 */

import { createApp, h } from 'vue'
import type { AppState, IUIPortal } from './types'
import Tooltip from './views/Tooltip.vue'
import DisambiguationModal from './views/DisambiguationModal.vue'
import { getMaxZIndex } from '~/logic/dom'
import type { Candidate } from '~/logic/search'

/**
 * UI 门户定义的操作回调接口
 */
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

  constructor(
    private state: AppState, 
    private actions: UIPortalActions
  ) {}

  /**
   * 挂载 UI 容器到 DOM
   * 创建 Shadow Root 并初始化 Vue 应用
   */
  mount() {
    const container = document.createElement('div')
    container.id = __NAME__
    container.style.position = 'fixed'
    container.style.zIndex = `${getMaxZIndex() + 1}`

    // 1. 创建隔离层 (Shadow DOM)
    const shadowDOM = container.attachShadow?.({ mode: 'open' }) || container
    
    // 注入扩展样式
    const styleLinkElement = document.createElement('link')
    styleLinkElement.setAttribute('rel', 'stylesheet')
    styleLinkElement.setAttribute('href', browser.runtime.getURL('dist/contentScripts/style.css'))
    shadowDOM.appendChild(styleLinkElement)

    // 2. 初始化 UI 根节点
    const uiRootElement = document.createElement('div')
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDarkMode) uiRootElement.classList.add('dark')
    shadowDOM.appendChild(uiRootElement)

    // 3. 挂载 Tooltip 组件
    const tooltipRootElement = document.createElement('div')
    uiRootElement.appendChild(tooltipRootElement)
    this.tooltipApp = createApp(Tooltip, {
      onSave: this.actions.onSave,
      onDelete: this.actions.onDelete,
      onColorChange: this.actions.onColorChange,
      onClearPreview: this.actions.onClearPreview
    }).mount(tooltipRootElement)

    // 4. 挂载 歧义处理弹窗 组件 (DisambiguationModal)
    const modalRootElement = document.createElement('div')
    uiRootElement.appendChild(modalRootElement)
    createApp({
      render: () =>
        h(DisambiguationModal, {
          ambiguousMarksData: this.state.ambiguousMarks,
          modelValue: this.state.ambiguousMarks.length > 0,
          'onUpdate:modelValue': (isVisible: boolean) => {
            if (!isVisible) this.state.ambiguousMarks = []
          },
          onConfirmResolution: this.actions.onConfirmResolution,
          onDiscardMark: this.actions.onDiscardMark,
          onCancel: () => {
            this.state.ambiguousMarks = []
          },
          'onHover-list-item': this.actions.onCandidateHover,
          'onLeave-list-item': this.actions.onCandidateLeave
        })
    }).mount(modalRootElement)

    document.body.appendChild(container)
  }

  /**
   * 显示高亮操作浮窗
   */
  showTooltip(x: number, y: number, isHighlighted: boolean, note: string, color: string | undefined, textToCopy: string) {
    this.tooltipApp?.show(x, y, isHighlighted, note, color, textToCopy)
  }

  /**
   * 隐藏高亮操作浮窗
   */
  hideTooltip() {
    this.tooltipApp?.hide()
  }

  /**
   * 触发歧义选择弹窗
   */
  showDisambiguation(marks: Candidate[]) {
    this.state.ambiguousMarks = marks
  }
}
