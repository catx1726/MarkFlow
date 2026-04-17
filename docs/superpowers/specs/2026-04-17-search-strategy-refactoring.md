# 💡 Design Spec: Search Logic Refactoring (Strategy Pattern)

- **Date**: 2026-04-17
- **Status**: Draft
- **Topic**: Refactor `src/logic/search.ts` to improve maintainability and adherence to SOLID principles.

## 1. Background & Motivation
The current search logic in `src/logic/search.ts` is implemented as a monolithic function `findCandidateElements`. It mixes multiple matching algorithms (Exact, Regex, and Multi-Anchor Consensus), making it hard to test, debug, and extend. This violates the **Single Responsibility Principle (SRP)** and the **Open/Closed Principle (OCP)**.

## 2. Proposed Architecture

### 2.1 Core Components
- **`SearchContext`**: A data object holding shared search state (full text, text nodes, etc.) to avoid redundant DOM traversals.
- **`SearchStrategy` (Interface)**: Defines a standard execution contract for all matching algorithms.
- **`SearchEngine`**: Orchestrates the execution of multiple strategies based on priority.

### 2.2 Concrete Strategies
1.  **`ExactMatchStrategy`**: Ported from Level 2 (Exact string match).
2.  **`RegexMatchStrategy`**: Ported from Level 2.5 (Whitespace-insensitive matching).
3.  **`ConsensusMatchStrategy`**: Ported from Level 3 (Multi-anchor fuzzy alignment).

## 4. Testing & Verification
- **Unit Tests**: Existing tests in `src/tests/search.spec.ts` must pass.
- **New Tests**: Add specific tests for each strategy class to ensure isolated correctness.
- **Standards Compliance**: Verify against `docs/standards/code-standards/README.md`.
