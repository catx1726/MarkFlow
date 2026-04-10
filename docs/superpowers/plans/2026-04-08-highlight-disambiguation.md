# Highlight Disambiguation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a tiered matching mechanism (Exact -> Contextual -> Fuzzy) to restore highlights when original Rangy paths fail due to DOM changes.

**Architecture:** Enhance metadata capture with surrounding text snippets, implement a fuzzy search utility using similarity scoring, and integrate the existing Disambiguation UI for manual resolution and data repair.

**Tech Stack:** TypeScript, Vue 3, Rangy, Vitest.

---

### Task 1: Metadata Enhancement (Capture surrounding snippet)

**Files:**
- Modify: `src/logic/storage.ts`
- Modify: `src/contentScripts/index.ts`
- Test: `src/tests/metadata.spec.ts`

- [x] **Step 1: Update `Mark` interface**
- [x] **Step 2: Write failing test for metadata capture**
- [x] **Step 3: Update `createHighlight` to capture snippet**
- [x] **Step 4: Run tests and commit**

---

### Task 2: Core Search Logic - Tiered Matching & Fuzzy Scoring

**Files:**
- Modify: `src/logic/search.ts`
- Test: `src/tests/search.spec.ts`

- [x] **Step 1: Implement Similarity Utility**
- [x] **Step 2: Update `findCandidateElements` with fuzzy logic**
- [x] **Step 3: Write tests for fuzzy matching**
- [x] **Step 4: Run tests and commit**

---

### Task 3: Integration - Fallback & UI Trigger

**Files:**
- Modify: `src/contentScripts/index.ts`

- [x] **Step 1: Update `applyMarks` to handle multiple candidates**
- [x] **Step 2: Trigger Modal after restoration loop**
- [x] **Step 3: Implement `handleConfirmResolution` (Data Repair)**
- [x] **Step 4: Verify with smoke test and commit**

---

### Task 4: Final Verification & Cleanup

- [x] **Step 1: Run full test suite**
- [x] **Step 2: Final commit**
    `git commit -m "feat: implement highlight disambiguation with tiered matching and UI integration"`

