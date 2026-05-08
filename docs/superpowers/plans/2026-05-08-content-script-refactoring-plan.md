# Content Script 重构 Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **ZBC 约束**：本 Plan 不提供提取代码模板。每个 Task 的提取步骤必须：
> 1. `git show main:src/contentScripts/index.ts` 读取当前 main 的原始代码
> 2. 逐行复制到新文件（仅调整 import/export 语句）
> 3. `git diff` 确认 index.ts 删除了正确内容，新文件包含了正确内容
> 4. 运行 `npx vitest run` 确认无回归

**Goal:** 将 `src/contentScripts/index.ts` (1083行) 拆分为 5 个类，增量式重构，每步测试后提交。

**Architecture:** `ShadowDOMManager`（零依赖）→ `HighlightStateManager`（零依赖）→ `UIManager`（依赖前两个）→ `ContentChangeMonitor`（依赖 State）→ `HighlightRestorer`（依赖全部）→ `index.ts` 最终精简。

**Tech Stack:** Vue 3 + TypeScript + Rangy + Vitest + jsdom

**Spec:** `docs/superpowers/specs/2026-04-28-content-script-refactoring-design.md`

---

### Task 1: ShadowDOMManager 类

**提取目标**：将 Shadow DOM 相关的纯工具函数抽取为静态类。

**Files:**
- Create: `src/logic/shadowDom.ts`
- Create: `src/tests/shadowDom.spec.ts`
- Reference: `src/logic/dom.ts` (现有类封装风格)

- [ ] **Step 1: 读取 main 的 index.ts**

Run: `git show main:src/contentScripts/index.ts > main_index.ts`

从 main_index.ts 中定位以下代码片段：

- **`SHADOW_HOST_SEPARATOR` 常量**：`'|>>>|'` 字符串（出现在 `handleConfirmResolution`、`createHighlight`、`applyMarks` 中）
- **shadowHostSelector 构建逻辑**：在 `handleConfirmResolution`（~L391-399）、`createHighlight`（~L748-756）、`applyMarks`（~L980-988）中重复的 `chain.unshift/getElementSelector` 循环
- **shadowHostSelector 解析逻辑**：在 `applyMarks`（~L901-918）中的 `split/querySelector` 链式解析
- **`setupShadowDOMAndUI` 中的容器创建/样式/暗黑模式**（~L253-269）

- [ ] **Step 2: 创建 `src/logic/shadowDom.ts`**

- 提取 `SHADOW_HOST_SEPARATOR` 为命名常量
- 创建 `ShadowDOMManager` 类，包含以下静态方法：
  - `createContainer(id, zIndex)`：从 `setupShadowDOMAndUI` 的容器创建逻辑提取（含 id、fixed、zIndex、fontSize 设置）
  - `attachStylesheet(shadowRoot, href)`：从 `setupShadowDOMAndUI` 的 stylesheet 链接提取
  - `createDarkModeClass(shadowRoot)`：从 `setupShadowDOMAndUI` 的暗黑模式检测提取
  - `buildShadowHostSelector(element)`：从三处重复的 shadowHostSelector 构建逻辑提取
  - `resolveShadowHost(selector)`：从 `applyMarks` 的 shadowHost 解析逻辑提取
- **关键约束**：所有方法的实现必须与 main_index.ts 中的原始代码逐行一致，仅添加 `export` 和类包装

- [ ] **Step 3: 创建 `src/tests/shadowDom.spec.ts`**

覆盖 `createContainer`、`buildShadowHostSelector`（shadow root 内和普通 DOM）、`resolveShadowHost`（单层和多层）

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/tests/shadowDom.spec.ts`（或 `npm test`）
Expected: All tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/logic/shadowDom.ts src/tests/shadowDom.spec.ts
git commit -m "feat: extract ShadowDOMManager class"
```

---

### Task 2: HighlightStateManager 类

**提取目标**：将所有模块级状态变量封装为类。

**Files:**
- Create: `src/contentScripts/state.ts`
- Create: `src/tests/state.spec.ts`

- [ ] **Step 1: 创建 `src/contentScripts/state.ts`**

从 main_index.ts 中定位并提取：
- **Interface 定义**（`TooltipInstance`、`DisambiguationModalInstance`）：~L154-169
- **所有 `let`/`const` 模块级变量**（`restoredMarkIds`、`failedRestoreCooldowns`、`ambiguousMarksQueue`、`modalState`、`tooltipDebounceTimer`、`restoreDebounceTimer`、`selectionTimer`、`tooltipApp`、`disambiguationModalApp`、`currentSerializationRoot`、`serializedSelection`、`currentMarkIdForColorChange`、`originalColorForChange`、`previewApplier`、`isRestoring`）：~L174-193
- **命名常量**：`COOLDOWN_DURATION = 3000`

**关键约束**：
- `tooltipDebounceTimer`、`restoreDebounceTimer`、`selectionTimer`、`previewApplier` 这四个变量**保持为模块级**（不进入类），因为它们在 index.ts 中被直接读写
- `originalColorForChange` 保持模块级（后续由 UIManager 使用）

- [ ] **Step 2: 创建 `src/tests/state.spec.ts`**

覆盖：空状态初始化、restored 标记追踪、cooldown 管理、`canRestore`、歧义队列去重、`clearSelectionState`、`clearAll`

- [ ] **Step 3: 运行测试**

Run: `npx vitest run src/tests/state.spec.ts`
Expected: All tests PASS

- [ ] **Step 4: 提交**

```bash
git add src/contentScripts/state.ts src/tests/state.spec.ts
git commit -m "feat: extract HighlightStateManager class"
```

---

### Task 3: UIManager 类

**提取目标**：将所有 UI 相关函数提取到 UIManager。

**Files:**
- Create: `src/contentScripts/ui.ts`
- Create: `src/tests/ui.spec.ts`
- Modify: `src/contentScripts/index.ts`（移除提取的函数）

- [ ] **Step 1: 创建 `src/contentScripts/ui.ts`**

从 main_index.ts 定位并提取以下函数，每个函数的实现必须与 main_index.ts 完全一致（仅添加 `private`/`public` 和类包装）：

- `setupShadowDOMAndUI`（~L253-317）：UI 创建逻辑。注意保持 `uiRoot` + `dark` class + 挂载顺序
- `handleCandidateHover`（~L319-329）
- `handleCandidateLeave`（~L331-344）
- `handleDiscardMark`（~L346-352）
- `ensureUIMounted`（~L354-363）
- `handleConfirmResolution`（~L365-428）
- `handleColorChange`（~L446-472）
- `handleClearPreview`（~L474-483）— **含 `originalColorForChange` 恢复逻辑**
- `clearPreviewHighlight`（~L647-666）
- `handleSaveAction`（~L672-703）
- `handleDeleteAction`（~L705-718）
- `removeMarkById`（~L720-733）
- `createHighlight`（~L735-785）
- `showTooltipForSelection`（~L639-645）
- `handleInitialLoadActions`（~L430-444）— 注意它调用 `restoreHighlights` 和 `scrollToMark`

**关键约束**：
- `originalColorForChange`：在 UIManager 中添加同名私有字段
- `tooltipDebounceTimer`：在 UIManager 中添加同名私有字段
- `tooltipApp`、`disambiguationModalApp`：在 UIManager 中改为 `state.tooltipApp`、`state.disambiguationModalApp`
- `handleSaveAction` 中调用 `createHighlight` → 改为 `this.createHighlight`
- `handleConfirmResolution` 中引用 `restoredMarkIds`、`failedRestoreCooldowns`、`ambiguousMarksQueue` → 改为 `state.*`
- `handleConfirmResolution` 中引用 `sendMessage`、`getCanonicalUrlForMark`、`applyPreciseHighlight`、`getHighlightContext`、`getElementSelector`、`stripHighlights`、`rangy` → 保持 import

- [ ] **Step 2: 创建 `src/tests/ui.spec.ts`**

测试：初始化状态、`clearPreviewHighlight`、`hideTooltip`、`setOriginalColorForChange`

注意：需要 mock `webextension-polyfill`、`webext-bridge/content-script`、`~/logic/settings`

- [ ] **Step 3: 从 index.ts 移除提取的函数**

删除 main_index.ts 中 ~L253-483、~L639-785 范围内的函数体。
将 `import` 中的 `createApp`、`h`、`reactive`、`ref`、`Tooltip`、`DisambiguationModal` 移除。
添加 `import { UIManager } from './ui'` 和 `const ui = new UIManager(state)`。

- [ ] **Step 4: 验证——用 git diff 对比行为**

Run: `git diff`
确认：extracted functions 从 index.ts 中正确移除，且 ui.ts 中的方法实现与原始代码一致（忽略 import/class 包装）

- [ ] **Step 5: 运行全量测试**

Run: `npx vitest run`
Expected: 与 main 分支测试结果一致（仅 pre-existing 失败）

- [ ] **Step 6: 提交**

```bash
git add src/contentScripts/ui.ts src/tests/ui.spec.ts
git commit -m "feat: extract UIManager class"
```

---

### Task 4: ContentChangeMonitor + HighlightRestorer 类

**提取目标**：将恢复逻辑和 DOM 变更监控独立。

**Files:**
- Create: `src/contentScripts/monitor.ts`
- Create: `src/contentScripts/restorer.ts`
- Create: `src/tests/monitor.spec.ts`
- Create: `src/tests/restorer.spec.ts`
- Modify: `src/contentScripts/index.ts`

- [ ] **Step 1: 创建 `src/contentScripts/restorer.ts`**

从 main_index.ts 提取：
- `restoreHighlights`（~L814-852）：**仅保留恢复逻辑**（observer/SPA 部分由 monitor 接管）
- `debouncedRestore`（~L854-892）
- `applyMarks`（~L894-1035）
- `refreshHighlights`（~L1037-1052）
- `scrollToMark`（~L791-808）

**关键约束**：
- 所有引用 `restoredMarkIds` → `state.restoredMarkIds`
- 所有引用 `failedRestoreCooldowns` → `state.failedRestoreCooldowns`
- 所有引用 `ambiguousMarksQueue` → `state.ambiguousMarksQueue`
- 所有引用 `isRestoring` → `state.isRestoring`
- 所有引用 `disambiguationModalApp?.show` → `this.ui.showDisambiguationModal()`
- `restoreHighlights` 中的 observer/SPA 代码（~L837-851）**移到 monitor**，restorer 中不保留
- `handleConfirmResolution` 留在 ui.ts，不做移动

- [ ] **Step 2: 创建 `src/contentScripts/monitor.ts`**

从 main_index.ts 提取 observer/SPA 逻辑：
- `restoreHighlights` 中的 MutationObserver 创建（~L837-842）
- `restoreHighlights` 中的 SPA listener + pushState 拦截（~L844-851）
- `debouncedRestore` 中的 observer 去重逻辑（`if (isRestoring) return`、`clearTimeout`、`setTimeout`）

- [ ] **Step 3: 从 index.ts 移除提取的函数**

删除 main_index.ts 中的：
- ~L791-808（`scrollToMark`）
- ~L814-852（`restoreHighlights`）
- ~L854-892（`debouncedRestore`）
- ~L894-1035（`applyMarks`）
- ~L1037-1052（`refreshHighlights`）

添加 import 和实例化：
```
import { HighlightRestorer } from './restorer'
import { ContentChangeMonitor } from './monitor'
const restorer = new HighlightRestorer(state, ui)
const monitor = new ContentChangeMonitor(state, () => restorer.restoreHighlights())
```

在 `initialize()` 中，`await handleInitialLoadActions()` 之后添加：
```
monitor.setupObservers()
monitor.setupSPAListener()
```

**注意**：这里改变了 observer 的启动时机（从 restoreHighlights 内部移到 initialize 的后续步骤）。这是计划内的改变——observer 在初始恢复完成后才开始，避免了竞态条件。

- [ ] **Step 4: 创建测试文件**

- `monitor.spec.ts`：初始化、destroy、setupSPAListener
- `restorer.spec.ts`：初始化、`restoreHighlights`（无 marks）、`refreshHighlights`、`scrollToMark`
- 需要 mock `webextension-polyfill`、`webext-bridge/content-script`、`~/logic/settings`

- [ ] **Step 5: 运行全量测试**

Run: `npx vitest run`
Expected: 与 main 测试结果一致

- [ ] **Step 6: 提交**

```bash
git add src/contentScripts/restorer.ts src/contentScripts/monitor.ts src/tests/restorer.spec.ts src/tests/monitor.spec.ts
git commit -m "feat: extract HighlightRestorer and ContentChangeMonitor classes"
```

---

### Task 5: 清理并验证

- [ ] **Step 1: 删除临时文件**

Run: `rm -f main_index.ts`

- [ ] **Step 2: 全量测试**

Run: `npx vitest run`
Expected: All tests PASS（pre-existing 失败除外）

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新增类型错误

- [ ] **Step 4: 最终提交**

```bash
git add .
git commit -m "refactor: content script class encapsulation (Issue #26)"
```
