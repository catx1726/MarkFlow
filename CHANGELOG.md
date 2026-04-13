# Unreleased

### [2026-04-10] feat: implement cross-element highlight restoration (#20)
- Support restoring highlights that span across multiple block elements (e.g., between `<p>` tags).
- Refactored search algorithm to use Least Common Ancestor (LCA) for candidate containers.
- Enhanced highlight application logic to correctly handle cross-TextNode boundaries.
- Centralized DOM manipulation logic in `src/logic/dom.ts`.

### [2026-04-10] feat: automate CHANGELOG.md update and update GEMINI.md diagram (#19)
feat: automate CHANGELOG.md update and update GEMINI.md diagram


## [2026-04-08] - Highlight Disambiguation
### Added
- Implement tiered matching algorithm (Exact -> Contextual -> Fuzzy) for highlight restoration.
- New `DisambiguationModal` UI for manual resolution of multiple candidates.
- Context fingerprinting: Capture 20-char snippets before and after selection.
- Automatic storage repair: Update Rangy paths after successful manual resolution.

### Changed
- Refactored `src/contentScripts/index.ts` to integrate tiered restoration flow.
- Enhanced `findCandidateElements` with fuzzy similarity scoring (Dice's Coefficient).

# Released

## [2025-12-22] 
- Add '结构性回顾' to package.json keywords (194a907)

## [2025-12-30] 
- Merge pull request #5 from catx1726/task/3-fix-shadow-dom (096d935)

## [2025-12-30] 
- Merge pull request #8 from catx1726/task/7-options-desc (9d9c57a)

## [2025-12-30] 
- Merge pull request #9 from catx1726/test/6-options-blacklist (0b1b4cb)

## [2025-12-31] 
- Merge pull request #11 from catx1726/task/10-side-save (9db9003)

## [2025-12-31] 
- doc: 修改插件名称为 MarkFlow (da9a405)

## [2025-12-31] 
- Merge branches 'main' and 'main' of github.com:catx1726/Tool-Webext-Tag-Content (83a87c4)

## [2025-12-31] 
- Merge branch 'main' of https://github.com/catx1726/MarkFlow (39f9c07)

## [2025-12-31] 
- build: 0.5.0 (59dcd09)

## [2025-12-31] 
- doc: index.html (ce80904)

## [2025-12-31] 
- Merge branch 'main' of github.com:catx1726/MarkFlow (b2812c5)

## [2025-12-31] 
- Merge pull request #13 from catx1726/task/12-alt-fix (2438e90)

## [2025-12-31] 
- env:update version (f197d9d)

## [2026-03-27] 
- Merge branch 'main' of github.com:catx1726/MarkFlow (6824d53)
