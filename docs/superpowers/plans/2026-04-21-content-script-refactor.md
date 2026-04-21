# Content Script 架构重构执行计划 (Refactor Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `@src/contentScripts/index.ts` 重构为模块化的类架构（App, Restorer, Interaction, UI），消除职责过载并提升可维护性。

**Architecture:** 采用 Manager-Service 协作模型，通过 Vue `reactive` 共享状态，将逻辑解耦为四个核心类：`MarkerApp` (总控), `RestorationEngine` (核心恢复), `InteractionController` (用户交互), `UIPortal` (UI 门户)。

**Tech Stack:** TypeScript, Vue 3, Rangy, WebExt-Bridge.

---

### Task 1: 定义核心状态模型与接口 (Core State & Interfaces)

**Files:**
- Create: `src/contentScripts/types.ts`

- [ ] **Step 1: 创建类型定义文件**
写入基础状态接口和各模块的抽象接口定义。

```typescript
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
```

- [ ] **Step 2: 验证文件存在并提交**
```bash
git add src/contentScripts/types.ts
git commit -m "chore: define core state and interfaces for content script refactor"
```

### Task 2: 抽离 UIPortal (UI Portal Extraction)

**Files:**
- Create: `src/contentScripts/UIPortal.ts`
- Modify: `src/contentScripts/index.ts`

- [ ] **Step 1: 实现 UIPortal 类**
迁移现有的 `setupShadowDOMAndUI` 逻辑到类中。

```typescript
import { createApp, h } from 'vue'
import type { AppState, IUIPortal } from './types'
import Tooltip from './views/Tooltip.vue'
import DisambiguationModal from './views/DisambiguationModal.vue'
import { getMaxZIndex } from '~/logic/dom'
import type { Candidate } from '~/logic/search'

export class UIPortal implements IUIPortal {
  private tooltipApp: any = null
  private modalState = { visible: false, marks: [] as Candidate[] }

  constructor(private state: AppState, private actions: any) {}

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
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) uiRoot.classList.add('dark')
    shadowDOM.appendChild(uiRoot)

    // Tooltip
    const tooltipRoot = document.createElement('div')
    uiRoot.appendChild(tooltipRoot)
    this.tooltipApp = createApp(Tooltip, {
      onSave: this.actions.onSave,
      onDelete: this.actions.onDelete,
      onColorChange: this.actions.onColorChange,
      onClearPreview: this.actions.onClearPreview
    }).mount(tooltipRoot)

    // Modal
    const modalRoot = document.createElement('div')
    uiRoot.appendChild(modalRoot)
    createApp({
      render: () => h(DisambiguationModal, {
        ambiguousMarksData: this.state.ambiguousMarks,
        modelValue: this.state.ambiguousMarks.length > 0,
        'onUpdate:modelValue': (val: boolean) => { if(!val) this.state.ambiguousMarks = [] },
        onConfirmResolution: this.actions.onConfirmResolution,
        onDiscardMark: this.actions.onDiscardMark,
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
```

- [ ] **Step 2: 验证编译并提交**
```bash
git add src/contentScripts/UIPortal.ts
git commit -m "feat: extract UIPortal for UI isolation"
```

### Task 3: 抽离 InteractionController (Interaction Logic)

**Files:**
- Create: `src/contentScripts/InteractionController.ts`

- [ ] **Step 1: 实现 InteractionController 类**
迁移 `handleMouseDown`, `handleMouseUp`, `processSelection` 等逻辑。

```typescript
import rangy from 'rangy/lib/rangy-core'
import type { AppState, IInteractionController, IUIPortal } from './types'

export class InteractionController implements IInteractionController {
  private selectionTimer: number | undefined

  constructor(private state: AppState, private ui: IUIPortal, private actions: any) {}

  setupListeners() {
    this.attachListeners(document)
  }

  private attachListeners(root: Document | ShadowRoot) {
    root.addEventListener('mousedown', (e) => this.handleMouseDown(e as MouseEvent), true)
    root.addEventListener('mouseup', (e) => this.handleMouseUp(e as MouseEvent), true)
    
    root.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) this.attachListeners(el.shadowRoot)
    })
  }

  private handleMouseDown(event: MouseEvent) {
    const path = event.composedPath() as HTMLElement[]
    if (path.some(el => el.classList?.contains('tooltip-card'))) return
    
    this.ui.hideTooltip()
    this.actions.clearPreview()
  }

  private handleMouseUp(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
    
    clearTimeout(this.selectionTimer)
    const eventSnapshot = {
      clientX: event.clientX,
      clientY: event.clientY,
      altKey: event.altKey,
      detail: event.detail,
      path: event.composedPath()
    }
    this.selectionTimer = window.setTimeout(() => this.processSelection(eventSnapshot), 50) as any
  }

  private processSelection(event: any) {
    const sel = rangy.getSelection()
    if (event.altKey && !sel.isCollapsed) {
       // ... 迁移原有逻辑，更新 state.currentSelection 并调用 ui.showTooltip
    }
  }
}
```

- [ ] **Step 2: 提交**
```bash
git add src/contentScripts/InteractionController.ts
git commit -m "feat: extract InteractionController for user interaction management"
```

### Task 4: 抽离 RestorationEngine (Core Engine)

**Files:**
- Create: `src/contentScripts/RestorationEngine.ts`

- [ ] **Step 1: 实现 RestorationEngine 类**
迁移 `restoreHighlights`, `applyMarks`, `MutationObserver` 逻辑。

```typescript
import { sendMessage } from 'webext-bridge/content-script'
import type { AppState, IRestorationEngine } from './types'
import { getCanonicalUrlForMark } from '~/logic/dom'

export class RestorationEngine implements IRestorationEngine {
  private restoredMarkIds = new Set<string>()
  private cooldowns = new Map<string, number>()
  private restoreTimer: number | undefined

  constructor(private state: AppState) {}

  async restore() {
    const url = getCanonicalUrlForMark()
    const marks = await sendMessage('get-marks-for-url', { url }, 'background')
    // ... 实现四级恢复逻辑，如果是歧义则填充 state.ambiguousMarks
  }

  debouncedRestore() {
    if (this.state.isRestoring) return
    clearTimeout(this.restoreTimer)
    this.restoreTimer = window.setTimeout(() => this.restore(), 300) as any
  }

  setupObserver() {
    const observer = new MutationObserver(() => this.debouncedRestore())
    observer.observe(document.body, { childList: true, subtree: true })
  }
}
```

- [ ] **Step 2: 提交**
```bash
git add src/contentScripts/RestorationEngine.ts
git commit -m "feat: extract RestorationEngine for high-performance mark restoration"
```

### Task 5: 重构入口文件 (Refactor Bootstrapper)

**Files:**
- Modify: `src/contentScripts/index.ts`

- [ ] **Step 1: 清空 index.ts 并实现 MarkerApp 引导类**
使用新创建的类初始化应用。

```typescript
import { reactive } from 'vue'
import { MarkerApp } from './MarkerApp' // 临时定义或直接写在 index.ts

const state = reactive<AppState>({
  isRestoring: false,
  ambiguousMarks: [],
  currentSelection: null,
  currentMarkIdForColorChange: null
})

// 初始化模块并启动
// ...
```

- [ ] **Step 2: 验证完整功能并提交**
```bash
git add src/contentScripts/index.ts
git commit -m "refactor: consolidate content script into MarkerApp architecture"
```
