# Highlight Disambiguation Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a content-aware re-matching mechanism and a disambiguation UI to handle highlight restoration after DOM reordering.

**Architecture:** A recursive search function (`findCandidateElements`) will traverse DOM/Shadow roots to find text matches. If multiple matches exist, a Vue-based `DisambiguationModal` will be presented for manual resolution. Confirmed matches update the stored serialization to ensure future persistence.

**Tech Stack:** TypeScript, Vue 3, Rangy, UnoCSS.

---

### Task 1: Research and Setup Metadata Capture

**Files:**
- Modify: `src/contentScripts/index.ts`
- Test: `src/tests/metadata.spec.ts` (Create if needed)

**Step 1: Write the failing test**
Ensure `createHighlight` captures necessary context metadata (`contextTitle`, `contextSelector`, `contextOrder`).

**Step 2: Run test to verify it fails**
Run: `npm run test`

**Step 3: Write minimal implementation**
Update `createHighlight` in `src/contentScripts/index.ts` to include robust context gathering.

**Step 4: Run test to verify it passes**
Run: `npm run test`

**Step 5: Commit**
`git commit -m "feat: enhance metadata capture in createHighlight"`

---

### Task 2: Core Search Logic - Recursive Traversal

**Files:**
- Create: `src/logic/search.ts`
- Test: `src/tests/search.spec.ts`

**Step 1: Write the failing test**
Test `findCandidateElements` with simple and nested Shadow DOM structures.

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**
Implement the recursive traversal logic in `src/logic/search.ts`.

**Step 4: Run test to verify it passes**

**Step 5: Commit**
`git commit -m "feat: implement recursive DOM/ShadowRoot traversal"`

---

### Task 3: Core Search Logic - Text Matching and Context Extraction

**Files:**
- Modify: `src/logic/search.ts`
- Test: `src/tests/search.spec.ts`

**Step 1: Write the failing test**
Test matching across text nodes and extracting surrounding characters.

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**
Enhance `findCandidateElements` to handle text node boundaries and extract context snippets.

**Step 4: Run test to verify it passes**

**Step 5: Commit**
`git commit -m "feat: add text matching and context extraction"`

---

### Task 4: UI - Disambiguation Modal Base

**Files:**
- Create: `src/contentScripts/views/DisambiguationModal.vue`
- Modify: `src/contentScripts/index.ts`

**Step 1: Write the failing test**
Verify the modal can be mounted and displays a list of candidates.

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**
Implement the base structure of `DisambiguationModal.vue` using Vue 3.

**Step 4: Run test to verify it passes**

**Step 5: Commit**
`git commit -m "feat: create base DisambiguationModal component"`

---

### Task 5: UI - Hover and Scroll Interaction

**Files:**
- Modify: `src/contentScripts/views/DisambiguationModal.vue`
- Modify: `src/contentScripts/index.ts`

**Step 1: Write the failing test**
Verify hovering over a candidate scrolls to the element and applies a temporary highlight.

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**
Add `onMouseOver` handlers to modal items and implement the scroll/highlight logic.

**Step 4: Run test to verify it passes**

**Step 5: Commit**
`git commit -m "feat: add hover and scroll interaction to modal"`

---

### Task 6: Integration - Restoration Fallback

**Files:**
- Modify: `src/contentScripts/index.ts`

**Step 1: Write the failing test**
Simulate a reordering event where `rangy` fails and verify the re-matching fallback is triggered.

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**
Update `restoreHighlights` and `applyMarks` to use `findCandidateElements` when `deserializeRange` throws.

**Step 4: Run test to verify it passes**

**Step 5: Commit**
`git commit -m "feat: integrate re-matching fallback into restoration flow"`
