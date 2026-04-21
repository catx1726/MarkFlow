# Plan: Search & DOM Logic Refactoring (SOLID & Performance)

This plan tracks the refactoring of `search.ts` and `dom.ts` to adhere to the newly introduced engineering standards.

- **Status**: Partially Completed
- **Last Updated**: 2026-04-17

## ✅ Completed Tasks

### 1. Search Logic Strategy Pattern Implementation
- Decomposed monolithic `findCandidateElements` into discrete strategies: `ExactMatch`, `RegexMatch`, `ConsensusMatch`.
- Implemented **Atomic SRP** for Consensus logic via `ConsensusAnchorManager` and `LocalAligner`.
- Externalized `SEARCH_CONFIG` to eliminate magic numbers.
- Implemented **Dynamic Look Range** for better鲁棒性.
- **Verification**: 22/22 tests passed.

### 2. DOM Utilities Encapsulation
- Grouped 10+ utility functions into static classes: `DOMScanner`, `DOMSelector`, `Highlighter`, `URLNormalizer`.
- Maintained backward compatibility via deprecated aliases.
- Internalized tracking parameters into `URLNormalizer`.
- **Verification**: Integrated tests passed.

## 🔜 Pending TODOs (Technical Debt)

### 🚀 High Performance Binary Search (Level 5 Optimization)
- **Objective**: Reduce TextNode lookup complexity from $O(N)$ to $O(\log N)$.
- **Tasks**:
    - [ ] Update `SearchContext` to include `cumulativeOffsets: number[]`.
    - [ ] Implement `BinarySearch` utility for index-to-node mapping.
    - [ ] Refactor `createCandidate` to use the new $O(\log N)$ lookup.
- **Priority**: High (for large documents).

### 🧹 Clean Up Deprecated Aliases
- **Objective**: Complete the migration to the new Class-based API.
- **Tasks**:
    - [ ] Update all calls in `src/contentScripts/index.ts` to use `DOMScanner.xxx`, `Highlighter.xxx`, etc.
    - [ ] Remove `@deprecated` re-exports in `src/logic/dom.ts`.
- **Priority**: Medium.

## Verification & Testing
- `npm test`
- `npm run typecheck`
