# Content Script 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `src/contentScripts/index.ts` 拆分为 5 个类，增量式重构，每步测试后提交。

**Architecture:** 按照依赖关系从底层到顶层逐步提取：`ShadowDOMManager`（零依赖）→ `HighlightStateManager`（零依赖）→ `UIManager`（依赖前两个）→ `ContentChangeMonitor`（依赖 State）→ `HighlightRestorer`（依赖全部）→ `index.ts` 最终精简。

**Tech Stack:** Vue 3 + TypeScript + Rangy + Vitest + jsdom

**Spec:** `docs/superpowers/specs/2026-04-28-content-script-refactoring-design.md`

---

### Task 1: ShadowDOMManager 类

**Files:**
- Create: `src/logic/shadowDom.ts`
- Create: `src/tests/shadowDom.spec.ts`
- Reference: `src/logic/dom.ts` (现有类封装风格)

- [ ] **Step 1: Create `src/logic/shadowDom.ts` with the class skeleton**

```typescript
// src/logic/shadowDom.ts
import rangy from 'rangy/lib/rangy-core'
import { DOMSelector } from './dom'

export const SHADOW_HOST_SEPARATOR = '|>>>|'

export class ShadowDOMManager {
  static createContainer(id: string, zIndex: number): HTMLDivElement {
    const container = document.createElement('div')
    container.id = id
    container.style.position = 'fixed'
    container.style.zIndex = `${zIndex}`
    container.style.fontSize = '16px'
    return container
  }

  static attachStylesheet(shadowRoot: ShadowRoot, href: string): void {
    const styleEl = document.createElement('link')
    styleEl.setAttribute('rel', 'stylesheet')
    styleEl.setAttribute('href', href)
    shadowRoot.appendChild(styleEl)
  }

  static createDarkModeClass(shadowRoot: ShadowRoot): void {
    const uiRoot = document.createElement('div')
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) uiRoot.classList.add('dark')
    shadowRoot.appendChild(uiRoot)
  }

  static buildShadowHostSelector(element: Element): string | undefined {
    const root = element.getRootNode()
    if (!(root instanceof ShadowRoot)) return undefined
    const chain: string[] = []
    let currRoot: Node = root
    while (currRoot instanceof ShadowRoot) {
      chain.unshift(DOMSelector.getElementSelector(currRoot.host))
      currRoot = currRoot.host.getRootNode()
    }
    return chain.join(SHADOW_HOST_SEPARATOR)
  }

  static resolveShadowHost(selector: string): ShadowRoot | undefined {
    if (!selector) return undefined
    let host: Element | null = null
    if (selector.includes(SHADOW_HOST_SEPARATOR)) {
      const chain = selector.split(SHADOW_HOST_SEPARATOR)
      let currentRoot: Document | ShadowRoot = document
      for (const segment of chain) {
        host = currentRoot.querySelector(segment)
        if (host && host.shadowRoot) {
          currentRoot = host.shadowRoot
        } else {
          return undefined
        }
      }
    }
    if (host && host.shadowRoot) return host.shadowRoot
    return undefined
  }
}
```

- [ ] **Step 2: Create `src/tests/shadowDom.spec.ts`**

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { ShadowDOMManager, SHADOW_HOST_SEPARATOR } from '../logic/shadowDom'
import { DOMSelector } from '../logic/dom'

describe('ShadowDOMManager', () => {
  describe('createContainer', () => {
    it('should create a fixed-position div with correct id and zIndex', () => {
      const container = ShadowDOMManager.createContainer('test-app', 9999)
      expect(container.id).toBe('test-app')
      expect(container.style.position).toBe('fixed')
      expect(container.style.zIndex).toBe('9999')
    })
  })

  describe('buildShadowHostSelector', () => {
    it('should return undefined when element is not in ShadowRoot', () => {
      const div = document.createElement('div')
      document.body.appendChild(div)
      expect(ShadowDOMManager.buildShadowHostSelector(div)).toBeUndefined()
      document.body.removeChild(div)
    })

    it('should build selector chain for element inside ShadowRoot', () => {
      const host = document.createElement('div')
      host.id = 'shadow-host'
      const shadow = host.attachShadow({ mode: 'open' })
      const inner = document.createElement('span')
      inner.id = 'inner-el'
      shadow.appendChild(inner)
      document.body.appendChild(host)

      const selector = ShadowDOMManager.buildShadowHostSelector(inner)
      expect(selector).toContain('shadow-host')
      expect(selector).toContain(SHADOW_HOST_SEPARATOR)
      document.body.removeChild(host)
    })
  })

  describe('resolveShadowHost', () => {
    it('should resolve a single-level shadow host selector', () => {
      const host = document.createElement('div')
      host.id = 'resolve-test'
      const shadow = host.attachShadow({ mode: 'open' })
      document.body.appendChild(host)

      const resolved = ShadowDOMManager.resolveShadowHost('#resolve-test')
      expect(resolved).toBe(shadow)
      document.body.removeChild(host)
    })

    it('should return undefined for non-existent selector', () => {
      expect(ShadowDOMManager.resolveShadowHost('#non-existent')).toBeUndefined()
    })
  })
})
```

- [ ] **Step 3: Run the failing test**

Run: `npx vitest run src/tests/shadowDom.spec.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/logic/shadowDom.ts src/tests/shadowDom.spec.ts
git commit -m "feat: extract ShadowDOMManager class"
```

---

### Task 2: HighlightStateManager 类

**Files:**
- Create: `src/contentScripts/state.ts`
- Create: `src/tests/state.spec.ts`
- Reference: `src/contentScripts/index.ts:173-193` (现有状态变量)

- [ ] **Step 1: Create `src/contentScripts/state.ts`**

```typescript
// src/contentScripts/state.ts
import { ref, reactive } from 'vue'
import type { Candidate } from '~/logic/search'

export const COOLDOWN_DURATION = 3000

interface TooltipInstance {
  show: (x: number, y: number, isHighlighted: boolean, note: string, color: string | undefined, textToCopy: string) => void
  hide: () => void
}

interface DisambiguationModalInstance {
  show: (marks: Candidate[]) => void
  hide: () => void
}

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

  isRestored(id: string): boolean {
    return this.restoredMarkIds.has(id)
  }

  markRestored(id: string): void {
    this.restoredMarkIds.add(id)
  }

  markFailed(id: string): void {
    this.failedRestoreCooldowns.set(id, Date.now() + COOLDOWN_DURATION)
  }

  isOnCooldown(id: string): boolean {
    const cooldown = this.failedRestoreCooldowns.get(id)
    return cooldown ? Date.now() < cooldown : false
  }

  clearCooldown(id: string): void {
    this.failedRestoreCooldowns.delete(id)
  }

  canRestore(id: string): boolean {
    if (this.isRestored(id)) return false
    if (this.isOnCooldown(id)) return false
    return true
  }

  addToAmbiguousQueue(candidates: Candidate[]): void {
    const existing = this.ambiguousMarksQueue.value.filter(
      m => !candidates.some(c => c.originalMarkId === m.originalMarkId)
    )
    this.ambiguousMarksQueue.value = [...existing, ...candidates]
  }

  clearSelectionState(): void {
    this.currentSerializationRoot = undefined
    this.serializedSelection = null
    this.currentMarkIdForColorChange = null
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
    this.clearSelectionState()
  }
}
```

- [ ] **Step 2: Create `src/tests/state.spec.ts`**

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { HighlightStateManager, COOLDOWN_DURATION } from '../contentScripts/state'

describe('HighlightStateManager', () => {
  let state: HighlightStateManager

  beforeEach(() => {
    state = new HighlightStateManager()
  })

  it('should start with empty state', () => {
    expect(state.restoredMarkIds.size).toBe(0)
    expect(state.failedRestoreCooldowns.size).toBe(0)
    expect(state.ambiguousMarksQueue.value).toEqual([])
    expect(state.isRestoring).toBe(false)
    expect(state.serializedSelection).toBeNull()
  })

  it('should track restored marks', () => {
    expect(state.isRestored('mark-1')).toBe(false)
    state.markRestored('mark-1')
    expect(state.isRestored('mark-1')).toBe(true)
  })

  it('should handle cooldowns', () => {
    expect(state.isOnCooldown('mark-1')).toBe(false)
    state.markFailed('mark-1')
    expect(state.isOnCooldown('mark-1')).toBe(true)
    state.clearCooldown('mark-1')
    expect(state.isOnCooldown('mark-1')).toBe(false)
  })

  it('canRestore should check both restored and cooldown', () => {
    expect(state.canRestore('mark-1')).toBe(true)
    state.markRestored('mark-1')
    expect(state.canRestore('mark-1')).toBe(false)
  })

  it('should add to ambiguous queue without duplicates', () => {
    const c1 = { id: 'c1', originalMarkId: 'm1', candidateElement: document.createElement('div'), displayTextSnippet: 'text', displayContext: 'ctx', matchIndex: 0, matchLength: 4, originalMarkText: 'text' }
    state.addToAmbiguousQueue([c1])
    expect(state.ambiguousMarksQueue.value).toHaveLength(1)
    state.addToAmbiguousQueue([c1])
    expect(state.ambiguousMarksQueue.value).toHaveLength(1)
  })

  it('should clear selection state', () => {
    state.serializedSelection = 'test'
    state.currentMarkIdForColorChange = 'm1'
    state.currentSerializationRoot = document.documentElement
    state.clearSelectionState()
    expect(state.serializedSelection).toBeNull()
    expect(state.currentMarkIdForColorChange).toBeNull()
    expect(state.currentSerializationRoot).toBeUndefined()
  })

  it('should clear all state', () => {
    state.markRestored('m1')
    state.markFailed('m2')
    state.clearAll()
    expect(state.restoredMarkIds.size).toBe(0)
    expect(state.failedRestoreCooldowns.size).toBe(0)
  })
})
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/tests/state.spec.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/contentScripts/state.ts src/tests/state.spec.ts
git commit -m "feat: extract HighlightStateManager class"
```

---

### Task 3: UIManager 类

**Files:**
- Create: `src/contentScripts/ui.ts`
- Create: `src/tests/ui.spec.ts`
- Modify: `src/logic/shadowDom.ts` 导出 mountUI 相关基础设施
- Reference: `src/contentScripts/index.ts:272-382` (现有 UI 相关代码)

- [ ] **Step 1: Add `mountVueApp` helper to `ShadowDOMManager`**

在 `src/logic/shadowDom.ts` 末尾添加：

```typescript
import { createApp, h } from 'vue'

export class UIFactory {
  static mountTooltip(shadowRoot: ShadowRoot, tooltipComponent: any, handlers: Record<string, Function>): any {
    const root = document.createElement('div')
    shadowRoot.appendChild(root)
    return createApp(tooltipComponent, handlers).mount(root)
  }

  static mountModal(shadowRoot: ShadowRoot, modalComponent: any, modalState: { marks: any[], visible: boolean }, handlers: Record<string, Function>): { show: (marks: any[]) => void, hide: () => void } {
    const root = document.createElement('div')
    shadowRoot.appendChild(root)
    createApp({
      render: () =>
        h(modalComponent, {
          ambiguousMarksData: modalState.marks,
          modelValue: modalState.visible,
          'onUpdate:modelValue': (val: boolean) => { modalState.visible = val },
          ...handlers
        })
    }).mount(root)
    return {
      show: (marks: any[]) => { modalState.marks = marks; modalState.visible = true },
      hide: () => { modalState.visible = false }
    }
  }
}
```

- [ ] **Step 2: Create `src/contentScripts/ui.ts`**

```typescript
// src/contentScripts/ui.ts
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-classapplier'
import 'rangy/lib/rangy-serializer'
import { createApp, h } from 'vue'
import { ShadowDOMManager, UIFactory } from '~/logic/shadowDom'
import { querySelectorAllDeep, querySelectorDeep, DOMSelector, Highlighter } from '~/logic/dom'
import { sendMessage } from 'webext-bridge/content-script'
import { highlightDefaultStyle } from '~/logic/config'
import type { HighlightStateManager } from './state'
import type { Candidate } from '~/logic/search'
import Tooltip from './views/Tooltip.vue'
import DisambiguationModal from './views/DisambiguationModal.vue'

const TOOLTIP_DEBOUNCE = 50

export class UIManager {
  private tooltipDebounceTimer = 0
  private isMounted = false

  constructor(private state: HighlightStateManager) {}

  ensureMounted(): void {
    if (this.isMounted) return
    const container = document.getElementById(__NAME__)
    if (container) return

    const newContainer = ShadowDOMManager.createContainer(__NAME__, Highlighter.getMaxZIndex() + 1)
    const shadowDOM = newContainer.attachShadow?.({ mode: 'open' }) || newContainer
    ShadowDOMManager.attachStylesheet(shadowDOM, browser.runtime.getURL('dist/contentScripts/style.css'))

    const uiRoot = document.createElement('div')
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) uiRoot.classList.add('dark')
    shadowDOM.appendChild(uiRoot)

    this.state.tooltipApp = UIFactory.mountTooltip(uiRoot, Tooltip, {
      onSave: (note: string, color: string) => this.handleSave(note, color),
      onDelete: () => this.handleDelete(),
      onColorChange: (color: string, isExisting: boolean) => this.handleColorChange(color, isExisting),
      onClearPreview: () => this.handleClearPreview()
    }) as any

    this.state.disambiguationModalApp = UIFactory.mountModal(
      uiRoot, DisambiguationModal, this.state.modalState,
      {
        onConfirmResolution: (...args: any[]) => {},
        onDiscardMark: (...args: any[]) => {},
        onCancel: () => { this.state.modalState.visible = false },
        'onHover-list-item': (...args: any[]) => {},
        'onLeave-list-item': (...args: any[]) => {}
      }
    )

    document.body.appendChild(newContainer)
    this.isMounted = true
  }

  showTooltip(x: number, y: number, isHighlighted: boolean, note: string, color: string, text: string): void {
    clearTimeout(this.tooltipDebounceTimer)
    this.tooltipDebounceTimer = window.setTimeout(() => {
      this.ensureMounted()
      this.state.tooltipApp?.show(x, y, isHighlighted, note, color, text)
    }, TOOLTIP_DEBOUNCE)
  }

  hideTooltip(): void {
    this.state.tooltipApp?.hide()
  }

  showDisambiguationModal(): void {
    this.state.disambiguationModalApp?.show(this.state.ambiguousMarksQueue.value)
  }

  hideDisambiguationModal(): void {
    this.state.disambiguationModalApp?.hide()
  }

  clearPreviewHighlight(): void {
    const previewElements = querySelectorAllDeep('.webext-highlight-preview')
    const parentsToNormalize = new Set<Node>()
    previewElements.forEach((el) => {
      if (!(el instanceof HTMLElement)) return
      if (
        el.className.split(' ').some((cls) => cls.startsWith('webext-highlight-') && cls !== 'webext-highlight-preview')
      ) {
        el.classList.remove('webext-highlight-preview')
      } else {
        const parent = el.parentNode
        if (parent) {
          parentsToNormalize.add(parent)
          while (el.firstChild) parent.insertBefore(el.firstChild, el)
          parent.removeChild(el)
        }
      }
    })
    parentsToNormalize.forEach((parent) => parent.normalize())
  }

  private async handleSave(note: string, color: string): Promise<void> {
    if (this.state.currentMarkIdForColorChange) {
      await sendMessage(
        'update-mark-details',
        { id: this.state.currentMarkIdForColorChange, url: this.getCanonicalUrl(), note, color },
        'background'
      )
      document.querySelectorAll(`.webext-highlight-${this.state.currentMarkIdForColorChange}`).forEach((el) => {
        if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${color}`
      })
    }
    this.state.clearSelectionState()
  }

  private async handleDelete(): Promise<void> {
    if (this.state.currentMarkIdForColorChange) {
      await this.removeMarkById(this.state.currentMarkIdForColorChange)
    }
    this.state.clearSelectionState()
  }

  private handleColorChange(color: string, isExisting: boolean): void {
    if (isExisting && this.state.currentMarkIdForColorChange) {
      querySelectorAllDeep(`.webext-highlight-${this.state.currentMarkIdForColorChange}`).forEach((el) => {
        if (el instanceof HTMLElement) el.style.boxShadow = `inset 0 -5px 0 0 ${color}`
      })
    }
  }

  private handleClearPreview(): void {
    this.clearPreviewHighlight()
    rangy.getSelection().removeAllRanges()
  }

  private getCanonicalUrl(): string {
    const url = new URL(window.location.href)
    url.hash = ''
    const paramsToRemove = ['vd_source', 'spm_id_from', 'from_source', 'from', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
    paramsToRemove.forEach(p => url.searchParams.delete(p))
    let canonical = url.origin + url.pathname
    if (canonical.length > 1 && canonical.endsWith('/')) canonical = canonical.slice(0, -1)
    return canonical + url.search
  }

  async removeMarkById(markId: string): Promise<void> {
    const className = `webext-highlight-${markId}`
    const parentsToNormalize = new Set<Node>()
    querySelectorAllDeep(`.${className}`).forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        parentsToNormalize.add(parent)
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
      }
    })
    parentsToNormalize.forEach((parent) => parent.normalize())
    await sendMessage('remove-mark-by-id', { id: markId, url: this.getCanonicalUrl() }, 'background')
  }
}
```

- [ ] **Step 3: Create `src/tests/ui.spec.ts`**

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { UIManager } from '../contentScripts/ui'
import { HighlightStateManager } from '../contentScripts/state'

describe('UIManager', () => {
  let state: HighlightStateManager
  let ui: UIManager

  beforeEach(() => {
    state = new HighlightStateManager()
    ui = new UIManager(state)
  })

  it('should initialize with null tooltip and modal', () => {
    expect(state.tooltipApp).toBeNull()
    expect(state.disambiguationModalApp).toBeNull()
  })

  it('should clear preview highlight without error', () => {
    expect(() => ui.clearPreviewHighlight()).not.toThrow()
  })

  it('should hide tooltip without error when not mounted', () => {
    expect(() => ui.hideTooltip()).not.toThrow()
  })
})
```

- [ ] **Step 4: Run existing tests to verify no regression**

Run: `npx vitest run`
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/logic/shadowDom.ts src/contentScripts/ui.ts src/tests/ui.spec.ts
git commit -m "feat: extract UIManager class"
```

---

### Task 4: ContentChangeMonitor 类

**Files:**
- Create: `src/contentScripts/monitor.ts`
- Create: `src/tests/monitor.spec.ts`
- Reference: `src/contentScripts/index.ts:249-266` (现有 observer 代码)

- [ ] **Step 1: Create `src/contentScripts/monitor.ts`**

```typescript
// src/contentScripts/monitor.ts
import { querySelectorDeep } from '~/logic/dom'
import type { HighlightStateManager } from './state'

const RESTORE_DEBOUNCE = 300

export class ContentChangeMonitor {
  private observer: MutationObserver | null = null
  private restoreDebounceTimer = 0
  private onRestore: () => Promise<void>

  constructor(private state: HighlightStateManager, restoreCallback: () => Promise<void>) {
    this.onRestore = restoreCallback
  }

  setupGlobalObserver(): void {
    const commentContainer = querySelectorDeep('#comment, .comment-list, .comment-container') || document.body

    this.observer = new MutationObserver((mutations) => {
      const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0)
      if (hasAddedNodes) {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => this.debouncedRestore())
        } else {
          this.debouncedRestore()
        }
      }
    })
    this.observer.observe(commentContainer, { childList: true, subtree: true })
  }

  setupBodyObserver(): void {
    const bodyObserver = new MutationObserver((mutations) => {
      const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0)
      if (!hasAddedNodes) return
      this.debouncedRestore()
    })
    bodyObserver.observe(document.body, { childList: true, subtree: true })
  }

  setupSPAListener(): void {
    window.addEventListener('popstate', () => this.debouncedRestore())
    const originalPushState = history.pushState
    history.pushState = function (...args) {
      originalPushState.apply(this, args)
      this.debouncedRestore()
    }
  }

  private debouncedRestore(): void {
    if (this.state.isRestoring) return
    clearTimeout(this.restoreDebounceTimer)
    this.restoreDebounceTimer = window.setTimeout(async () => {
      this.state.isRestoring = true
      try {
        await this.onRestore()
      } finally {
        this.state.isRestoring = false
      }
    }, RESTORE_DEBOUNCE)
  }

  destroy(): void {
    this.observer?.disconnect()
    this.observer = null
  }
}
```

- [ ] **Step 2: Create `src/tests/monitor.spec.ts`**

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ContentChangeMonitor } from '../contentScripts/monitor'
import { HighlightStateManager } from '../contentScripts/state'

describe('ContentChangeMonitor', () => {
  let state: HighlightStateManager
  let monitor: ContentChangeMonitor
  let restoreCalled: boolean

  beforeEach(() => {
    restoreCalled = false
    state = new HighlightStateManager()
    monitor = new ContentChangeMonitor(state, async () => { restoreCalled = true })
  })

  it('should initialize without observer', () => {
    expect(monitor).toBeDefined()
  })

  it('destroy should not throw when observer is null', () => {
    expect(() => monitor.destroy()).not.toThrow()
  })
})
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/contentScripts/monitor.ts src/tests/monitor.spec.ts
git commit -m "feat: extract ContentChangeMonitor class"
```

---

### Task 5: HighlightRestorer 类

**Files:**
- Create: `src/contentScripts/restorer.ts`
- Create: `src/tests/restorer.spec.ts`
- Reference: `src/contentScripts/index.ts:818-1025` (恢复逻辑)
- Reference: `src/logic/search.ts` (findCandidateElements)
- Reference: `src/logic/dom.ts` (applyPreciseHighlight, getHighlightContext)

- [ ] **Step 1: Create `src/contentScripts/restorer.ts`**

```typescript
// src/contentScripts/restorer.ts
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-classapplier'
import 'rangy/lib/rangy-serializer'
import { sendMessage } from 'webext-bridge/content-script'
import type { Mark } from '~/logic/storage'
import { highlightDefaultStyle } from '~/logic/config'
import { settings } from '~/logic/settings'
import {
  DOMSelector,
  DOMScanner,
  Highlighter,
  TextAnalyzer,
  URLNormalizer
} from '~/logic/dom'
import { findCandidateElements, type Candidate } from '~/logic/search'
import { ShadowDOMManager } from '~/logic/shadowDom'
import type { HighlightStateManager } from './state'
import type { UIManager } from './ui'

const L1_SIMILARITY_THRESHOLD = 95
const CONTEXT_SIMILARITY_THRESHOLD = 80
const L3_SIMILARITY_THRESHOLD = 75

export class HighlightRestorer {
  constructor(
    private state: HighlightStateManager,
    private ui: UIManager
  ) {}

  async restoreHighlights(): Promise<void> {
    const canonicalUrl = URLNormalizer.getCanonicalUrl()
    const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')
    if (!marks || marks.length === 0) return

    this.state.ambiguousMarksQueue.value = []
    const marksToRestore = marks.filter((mark) => this.state.canRestore(mark.id))

    if (marksToRestore.length > 0) await this.applyMarks(marksToRestore)

    if (this.state.ambiguousMarksQueue.value.length > 0) {
      this.ui.showDisambiguationModal()
    }
  }

  async applyMarks(marks: Mark[]): Promise<void> {
    for (const mark of marks) {
      const applier = rangy.createClassApplier(`webext-highlight-${mark.id}`, {
        elementTagName: 'span',
        elementAttributes: { style: highlightDefaultStyle(mark.color) }
      })

      const resolvedRoot = this.resolveDeserializationRoot(mark)

      try {
        await this.tryL1Restore(mark, applier, resolvedRoot)
      } catch (e) {
        await this.handleL2L3Restore(mark, applier, resolvedRoot)
      }
    }
  }

  private resolveDeserializationRoot(mark: Mark): Node | undefined {
    if (!mark.shadowHostSelector) return undefined
    return ShadowDOMManager.resolveShadowHost(mark.shadowHostSelector)
  }

  private async tryL1Restore(mark: Mark, applier: rangy.RangyClassApplier, root: Node | undefined): Promise<void> {
    const range = rangy.deserializeRange(mark.rangySerialized, root, document)
    if (!range) throw new Error('Failed to deserialize range')

    const rangeText = range.toString().trim()
    const contentSim = TextAnalyzer.calculateSimilarity(rangeText, mark.text.trim())
    if (contentSim < L1_SIMILARITY_THRESHOLD) throw new Error('Content mismatch at path')

    if (mark.surroundingSnippet) {
      const currentContext = Highlighter.getHighlightContext(range)
      const contextSim = TextAnalyzer.calculateSimilarity(
        currentContext.surroundingSnippet, mark.surroundingSnippet
      )
      if (contextSim < CONTEXT_SIMILARITY_THRESHOLD) throw new Error('Context integrity mismatch')
    }

    applier.applyToRange(range)
    this.state.markRestored(mark.id)
    this.state.clearCooldown(mark.id)
  }

  private async handleL2L3Restore(mark: Mark, applier: rangy.RangyClassApplier, root: Node | undefined): Promise<void> {
    const searchRoot = root || document.documentElement
    let { ambiguityLevel, candidates } = findCandidateElements(mark, searchRoot, 10)

    if (candidates.length === 0 && root) {
      const globalResult = findCandidateElements(mark, document.documentElement, 10)
      ambiguityLevel = globalResult.ambiguityLevel
      candidates = globalResult.candidates
    }

    if (ambiguityLevel === 'unique' && candidates.length === 1) {
      await this.applyUniqueCandidate(mark, candidates[0], applier)
    } else if (ambiguityLevel === 'multiple') {
      this.state.addToAmbiguousQueue(candidates)
    } else {
      this.state.markFailed(mark.id)
    }
  }

  private async applyUniqueCandidate(
    mark: Mark, candidate: Candidate, applier: rangy.RangyClassApplier
  ): Promise<void> {
    const similarity = mark.surroundingSnippet
      ? TextAnalyzer.calculateSimilarity(candidate.displayContext, mark.surroundingSnippet)
      : 100

    if (similarity < L3_SIMILARITY_THRESHOLD) {
      this.state.addToAmbiguousQueue([candidate])
      return
    }

    const rangeResult = Highlighter.applyPreciseHighlight(
      candidate.candidateElement,
      candidate.displayTextSnippet,
      applier,
      candidate.matchIndex
    )

    if (rangeResult) {
      const { range } = rangeResult
      this.state.markRestored(mark.id)
      this.state.clearCooldown(mark.id)
      await this.updateMarkDetails(mark, candidate, range)
    } else {
      this.state.addToAmbiguousQueue([candidate])
    }
  }

  private async updateMarkDetails(
    mark: Mark, candidate: Candidate, range: rangy.RangyRange
  ): Promise<void> {
    const rootNode = candidate.candidateElement.getRootNode()
    const newSerialized = rangy.serializeRange(range, true, rootNode instanceof ShadowRoot ? rootNode : undefined)
    const { contextTitle, contextSelector, contextLevel, contextOrder, surroundingSnippet } =
      Highlighter.getHighlightContext(range)

    const shadowHostSelector = ShadowDOMManager.buildShadowHostSelector(candidate.candidateElement)

    const content = range.cloneContents()
    Highlighter.stripHighlights(content)
    const tempDiv = document.createElement('div')
    tempDiv.appendChild(content)
    const actualHtml = content.constructor === DocumentFragment ? tempDiv.innerHTML : range.toString()

    await sendMessage(
      'update-mark-details',
      {
        id: mark.id,
        url: mark.url,
        text: candidate.displayTextSnippet,
        html: actualHtml,
        rangySerialized: newSerialized,
        shadowHostSelector: shadowHostSelector || null,
        contextTitle,
        contextSelector,
        contextLevel,
        contextOrder,
        surroundingSnippet
      } as any,
      'background'
    )
  }

  async refreshHighlights(): Promise<void> {
    const highlights = DOMScanner.querySelectorAllDeep('span[class*="webext-highlight-"]')
    const parentsToNormalize = new Set<Node>()
    highlights.forEach((el) => {
      if (el.classList.contains('webext-highlight-preview')) return
      const parent = el.parentNode
      if (parent) {
        parentsToNormalize.add(parent)
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
      }
    })
    parentsToNormalize.forEach((parent) => parent.normalize())
    this.state.restoredMarkIds.clear()
    await this.restoreHighlights()
  }

  async scrollToMark(markId: string): Promise<void> {
    const className = `webext-highlight-${markId}`
    const element = DOMScanner.querySelectorDeep(`.${className}`)
    if (element) {
      const mark = await sendMessage('get-mark-by-id', { id: markId, url: URLNormalizer.getCanonicalUrl() }, 'background')
      if (!mark) return
      element.scrollIntoView({ behavior: 'auto', block: 'center' })
      DOMScanner.querySelectorAllDeep(`.${className}`).forEach((el) => {
        if (!(el instanceof HTMLElement)) return
        el.style.transition = 'box-shadow 0.5s ease-in-out'
        el.style.boxShadow = `inset 0 -5px 0 0 ${settings.value.highlightColors[1]}`
        setTimeout(() => {
          el.style.boxShadow = `inset 0 -5px 0 0 ${mark.color}`
        }, 1000)
      })
    }
  }
}
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/contentScripts/restorer.ts
git commit -m "feat: extract HighlightRestorer class"
```

---

### Task 6: 整合 index.ts 入口

**Files:**
- Modify: `src/contentScripts/index.ts` (精简为主线编排)
- No new tests (依赖现有测试回归验证)

- [ ] **Step 1: Rewrite `src/contentScripts/index.ts`**

使用新提取的类重写入口文件。保留初始化编排、事件处理、消息监听作为主线代码，将业务逻辑委托到各个类。

```typescript
import { collectError } from '../logic/errorCollector'

window.addEventListener('error', (event) => collectError(event.error, 'content'))
window.addEventListener('unhandledrejection', (event) => collectError(event.reason, 'content'))

console.log('[WebMarker] CONTENT SCRIPT LOADED AT TOP LEVEL')

import { onMessage, sendMessage } from 'webext-bridge/content-script'
import rangy from 'rangy/lib/rangy-core'
import 'rangy/lib/rangy-classapplier'
import 'rangy/lib/rangy-serializer'
import type { Mark } from '~/logic/storage'
import { highlightDefaultStyle, shortcuts } from '~/logic/config'
import { isPageBlacklisted, settings, settingsReady } from '~/logic/settings'
import {
  DOMScanner,
  DOMSelector,
  Highlighter,
  URLNormalizer,
  TextAnalyzer
} from '~/logic/dom'
import { findCandidateElements } from '~/logic/search'
import { getCanonicalUrlForMark } from '~/logic/dom'
import { ShadowDOMManager } from '~/logic/shadowDom'
import { HighlightStateManager } from './state'
import { UIManager } from './ui'
import { ContentChangeMonitor } from './monitor'
import { HighlightRestorer } from './restorer'
import '../styles'

const state = new HighlightStateManager()
const ui = new UIManager(state)
const restorer = new HighlightRestorer(state, ui)
const monitor = new ContentChangeMonitor(state, () => restorer.restoreHighlights())

let selectionTimer = 0
let previewApplier: rangy.RangyClassApplier | null = null

async function initialize() {
  console.log('[ContentScript] Initializing WebMarker...')
  try {
    await settingsReady
    console.log('[ContentScript] Settings ready.')
    if (isPageBlacklisted(window.location.href, settings.value.blacklist)) {
      console.log('[ContentScript] Page is blacklisted, skipping.')
      return
    }
    rangy.init()
    previewApplier = rangy.createClassApplier('webext-highlight-preview', {
      elementTagName: 'span',
      elementAttributes: { style: `${highlightDefaultStyle(settings.value.defaultHighlightColor)} ` },
      normalize: false
    })
    window.addEventListener('keydown', handleKeyDown)
    attachListenersToShadowRoots(document)
    monitor.setupGlobalObserver()
    await handleInitialLoadActions()
    console.log('[ContentScript] Initialization complete.')
  } catch (e) {
    console.error('[ContentScript] Initialization failed:', e)
  }
}

initialize()

function handleKeyDown(event: KeyboardEvent) {
  const [mod, key] = shortcuts.openSidePanel.split('+')
  if (event.altKey && mod.toLowerCase() === 'alt' && event.key.toLowerCase() === key.toLowerCase()) {
    event.preventDefault()
  }
}

function attachListenersToShadowRoots(rootNode: Document | ShadowRoot) {
  try {
    if (!rootNode) return
    rootNode.addEventListener('mousedown', handleMouseDown as EventListener, true)
    rootNode.addEventListener('mouseup', handleMouseUp as EventListener, true)
    const allElements = rootNode.querySelectorAll('*')
    for (const element of Array.from(allElements)) {
      if (element.shadowRoot) {
        attachListenersToShadowRoots(element.shadowRoot)
      }
    }
  } catch (error) {
    console.error('Failed to attach shadow listeners:', error)
  }
}

function handleMouseDown(event: MouseEvent) {
  clearTimeout(selectionTimer)
  const target = event.target as HTMLElement
  if (target instanceof Element && target.shadowRoot) return
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
  const path = event.composedPath() as HTMLElement[]
  if (path.some((el) => el instanceof HTMLElement && el.classList.contains('tooltip-card'))) return

  if (!target.closest('span[class*="webext-highlight-"]')) {
    ui.hideTooltip()
    ui.clearPreviewHighlight()
  }
}

function handleMouseUp(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
  const path = event.composedPath()
  if (event.button === 2 || path.some((el) => el instanceof HTMLElement && el.classList.contains('tooltip-card'))) return

  const eventSnapshot = {
    target,
    path: typeof event.composedPath === 'function' ? event.composedPath() : [target],
    clientX: event.clientX,
    clientY: event.clientY,
    altKey: event.altKey,
    detail: event.detail
  }
  clearTimeout(selectionTimer)
  selectionTimer = window.setTimeout(() => processSelection(eventSnapshot), 50)
}

function processSelection(event: {
  target: EventTarget | null
  path: EventTarget[]
  clientX: number
  clientY: number
  altKey: boolean
  detail: number
}) {
  const initialSelection = rangy.getSelection()
  const targetNode = event.target as Node
  const targetElement = (
    targetNode.nodeType === Node.ELEMENT_NODE ? targetNode : targetNode.parentNode
  ) as HTMLElement | null
  const markElement = targetElement?.closest('span[class*="webext-highlight-"]') as HTMLElement | null
  const isNewSelectionAction = event.altKey && !initialSelection.isCollapsed

  if (isNewSelectionAction) {
    ui.clearPreviewHighlight()
    let range: rangy.RangyRange | null = null
    if (event.detail >= 3) {
      const shadowRoot = event.path.find((node) => node instanceof ShadowRoot) as ShadowRoot | undefined
      if (shadowRoot) {
        const clickedElement = shadowRoot.elementFromPoint(event.clientX, event.clientY)
        if (clickedElement) {
          const blockElement = findContainingBlock(clickedElement)
          if (blockElement && blockElement.textContent?.trim()) {
            const correctedRange = rangy.createRange()
            correctedRange.selectNodeContents(blockElement)
            if (!correctedRange.collapsed) range = correctedRange
          }
        }
      }
    }
    if (!range) {
      const freshSelection = rangy.getSelection()
      if (freshSelection.rangeCount > 0 && !freshSelection.isCollapsed) range = freshSelection.getRangeAt(0)
    }
    if (range && !range.collapsed) {
      const capturedText = range.toString().trim()
      if (!capturedText) return
      try {
        const root = range.commonAncestorContainer.getRootNode()
        const capturedRoot = root instanceof ShadowRoot ? root : undefined
        state.serializedSelection = rangy.serializeRange(range, true, capturedRoot)
        state.currentSerializationRoot = capturedRoot
        state.currentMarkIdForColorChange = null
        previewApplier?.applyToRange(range)
        ui.showTooltip(event.clientX, event.clientY, false, '', settings.value.defaultHighlightColor, capturedText)
      } catch (e) {
        console.error('[WebMarker] Error during selection processing:', e)
        ui.hideTooltip()
      }
      return
    }
    ui.hideTooltip()
    return
  }

  if (markElement && initialSelection.isCollapsed) {
    if (markElement.classList.contains('webext-highlight-preview')) return
    handleExistingMarkClick(markElement, event.clientX, event.clientY)
    return
  }
  ui.hideTooltip()
  state.clearSelectionState()
}

function findContainingBlock(node: Node): HTMLElement {
  let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : (node as HTMLElement)
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const display = window.getComputedStyle(current as Element).display
      if (display === 'block' || display === 'list-item' || display.startsWith('table')) return current as HTMLElement
    }
    if (current.parentNode instanceof ShadowRoot) return current as HTMLElement
    current = current.parentNode
  }
  return node as HTMLElement
}

function handleExistingMarkClick(markElement: HTMLElement, x: number, y: number) {
  const markId = DOMSelector.getMarkIdFromElement(markElement)
  if (!markId) return
  state.currentMarkIdForColorChange = markId
  const allSpans = DOMScanner.querySelectorAllDeep(`.webext-highlight-${markId}`)
  if (allSpans.length === 0) return
  const range = rangy.createRange()
  range.setStartBefore(allSpans[0])
  range.setEndAfter(allSpans[allSpans.length - 1])
  const tempSelection = rangy.getSelection()
  tempSelection.removeAllRanges()
  tempSelection.addRange(range)
  state.currentSerializationRoot = undefined
  const root = range.commonAncestorContainer.getRootNode()
  if (root instanceof ShadowRoot) state.currentSerializationRoot = root
  state.serializedSelection = rangy.serializeSelection(tempSelection, true, state.currentSerializationRoot)
  showTooltipForExistingMark(markId, x, y)
}

async function showTooltipForExistingMark(markId: string, x: number, y: number) {
  const mark = await sendMessage('get-mark-by-id', { id: markId, url: getCanonicalUrlForMark() }, 'background')
  const note = mark ? mark.note : ''
  const color = mark ? mark.color : settings.value.defaultHighlightColor
  ui.showTooltip(x, y, true, note, color, mark?.text ?? '')
}

async function handleInitialLoadActions() {
  try {
    await restorer.restoreHighlights()
    const hash = window.location.hash
    if (!hash.startsWith('#__highlight-mark__')) return
    const markId = hash.substring('#__highlight-mark__'.length)
    if (!markId) return
    setTimeout(() => {
      restorer.scrollToMark(markId)
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }, 100)
  } catch (error) {
    console.error('Error during initial load actions:', error)
  }
}

async function createHighlight(
  rangyRange: rangy.RangyRange,
  note?: string,
  color: string = settings.value.defaultHighlightColor
) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const className = `webext-highlight-${uniqueId}`
  const applier = rangy.createClassApplier(className, {
    elementTagName: 'span',
    elementAttributes: { style: highlightDefaultStyle(color) }
  })
  const root = rangyRange.commonAncestorContainer.getRootNode()
  const rangySerialized = rangy.serializeRange(rangyRange, true, root instanceof ShadowRoot ? root : undefined)
  const selectedText = rangyRange.toString()
  const { contextTitle, contextSelector, contextLevel, contextOrder, surroundingSnippet } =
    Highlighter.getHighlightContext(rangyRange)
  const content = rangyRange.cloneContents()
  Highlighter.stripHighlights(content)
  const tempDiv = document.createElement('div')
  tempDiv.appendChild(content)
  const selectedHtml = content.constructor === DocumentFragment ? tempDiv.innerHTML : selectedText
  applier.applyToRange(rangyRange)
  const markData: Mark = {
    id: uniqueId,
    url: getCanonicalUrlForMark(),
    text: selectedText,
    html: selectedHtml,
    note: note || '',
    color,
    rangySerialized,
    shadowHostSelector: root instanceof ShadowRoot ? ShadowDOMManager.buildShadowHostSelector(root.host) : undefined,
    createdAt: Date.now(),
    title: document.title,
    contextTitle,
    contextSelector,
    contextLevel,
    contextOrder,
    surroundingSnippet
  }
  await sendMessage('add-mark', markData, 'background')
}

// --- Message Listeners ---
onMessage('refresh-highlights', async () => {
  await restorer.refreshHighlights()
})
onMessage('tab-prev', ({ data }) => {
  console.log(`[web-marker-extension] Navigate from page "${data.title}"`)
})
onMessage('goto-mark', ({ data }) => {
  restorer.scrollToMark(data.markId)
})
onMessage('remove-mark', async ({ data: markToRemove }) => {
  if (!markToRemove || !markToRemove.id) return
  await ui.removeMarkById(markToRemove.id)
})
onMessage('goto-chapter', ({ data }) => {
  const element = DOMScanner.querySelectorDeep(data.selector)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (element instanceof HTMLElement) {
      element.style.transition = 'outline 0.1s ease-in-out'
      element.style.outline = '3px solid #3B82F6'
      setTimeout(() => { element.style.outline = '' }, 1500)
    }
  }
})
```

注意：需要添加 `ShadowDOMManager` 的 import 到顶部。修改后的事件处理直接从 `state` 和 `ui` 实例读取和操作用户交互状态，不再操作模块级变量。

- [ ] **Step 2: Run all tests to verify regression**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/contentScripts/index.ts
git commit -m "feat: integrate refactored classes into index.ts entry"
```

---

### Task 7: 最终验证

- [ ] **Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Final commit with audit log**

```bash
git add .
git commit -m "refactor: content script class encapsulation (Issue #26)"
```
