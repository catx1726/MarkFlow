# 🚀 跨元素高亮恢复实现计划 (Cross-Element Restoration Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决高亮跨越多个 DOM 元素（如多个 `<p>` 或 `<div>`）时，搜索算法定位不准及恢复弹窗内容截断的问题。

**Architecture:** 
1. 搜索时识别匹配文本覆盖的所有文本节点。
2. 计算这些节点的最小公共祖先 (LCA) 作为候选容器。
3. 重构高亮应用逻辑，支持跨文本节点边界重建 Range。

**Tech Stack:** TypeScript, Rangy, Vue 3

---

### Task 1: 增强文本节点遍历与 Candidate 接口

**Files:**
- Modify: `src/logic/search.ts`
- Test: `src/tests/search.spec.ts`

- [ ] **Step 1: 更新 `Candidate` 接口，明确基准坐标**

```typescript
// src/logic/search.ts
export interface Candidate {
  id: string
  originalMarkId: string
  originalMarkText: string
  candidateElement: HTMLElement // 现在将是最小公共祖先
  displayTitle?: string
  displayTextSnippet: string
  displayContext: string
  similarityScore?: number
  matchIndex: number // 相对于 candidateElement 的本地起始偏移
  matchLength: number // 匹配文本的长度
}
```

- [ ] **Step 2: 编写测试用例验证跨元素文本提取**

```typescript
// src/tests/search.spec.ts
it('should extract text across multiple block elements', () => {
  document.body.innerHTML = '<div id="test"><p>Hello </p><p>World</p></div>'
  const nodes = getAllTextNodes(document.getElementById('test')!)
  const fullText = nodes.map(n => n.textContent).join('')
  expect(fullText).toBe('Hello World')
})
```

- [ ] **Step 3: 运行测试并提交**

---

### Task 2: 实现最小公共祖先 (LCA) 定位工具

**Files:**
- Modify: `src/logic/dom.ts`
- Test: `src/tests/metadata.spec.ts`

- [ ] **Step 1: 实现 `findCommonAncestor` 函数**

```typescript
// src/logic/dom.ts
export function findCommonAncestor(nodes: Node[]): HTMLElement {
  if (nodes.length === 0) return document.body
  if (nodes.length === 1) return (nodes[0].nodeType === Node.ELEMENT_NODE ? nodes[0] : nodes[0].parentElement) as HTMLElement

  const contain = (parent: Node, child: Node) => {
    while (child) {
      if (child === parent) return true
      child = child.parentNode!
    }
    return false
  }

  let lca = nodes[0].parentElement as HTMLElement
  for (let i = 1; i < nodes.length; i++) {
    while (lca && !contain(lca, nodes[i])) {
      lca = lca.parentElement as HTMLElement
    }
  }
  return lca || document.body
}
```

- [ ] **Step 2: 验证工具函数**
- [ ] **Step 3: 提交**

---

### Task 3: 重构搜索算法支持跨元素候选者

**Files:**
- Modify: `src/logic/search.ts`

- [ ] **Step 1: 修改 `createCandidate` 以支持多节点跨度**

```typescript
// src/logic/search.ts 中的 createCandidate 重构逻辑
function createCandidate(mark: Mark, matchIndex: number, textNodes: Text[], fullText: string): Candidate | null {
  const matchEnd = matchIndex + mark.text.length
  const involvedNodes: Text[] = []
  let currentPos = 0
  
  for (const node of textNodes) {
    const len = node.textContent?.length || 0
    const nodeEnd = currentPos + len
    if (nodeEnd > matchIndex && currentPos < matchEnd) {
      involvedNodes.push(node)
    }
    currentPos = nodeEnd
    if (currentPos >= matchEnd) break
  }

  if (involvedNodes.length === 0) return null

  const lca = findCommonAncestor(involvedNodes)
  // 计算相对于 LCA 的本地 matchIndex
  let lcaStartPos = 0
  for (const node of textNodes) {
    if (lca.contains(node)) break
    lcaStartPos += node.textContent?.length || 0
  }

  return {
    // ... 其他属性
    candidateElement: lca,
    matchIndex: matchIndex - lcaStartPos,
    matchLength: mark.text.length
  }
}
```

- [ ] **Step 2: 运行现有测试确保不破坏单元素匹配**
- [ ] **Step 3: 提交**

---

### Task 4: 增强高亮应用逻辑以支持跨节点 Range

**Files:**
- Modify: `src/contentScripts/index.ts`

- [ ] **Step 1: 重构 `applyPreciseHighlight` 以支持跨 TextNode 边界**

```typescript
// src/contentScripts/index.ts
function applyPreciseHighlight(
  container: HTMLElement,
  textToFind: string,
  applier: rangy.RangyClassApplier,
  preferredOffset: number
): { range: rangy.RangyRange, actualText: string } | null {
  const textNodes = getAllTextNodes(container)
  let currentLen = 0
  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0

  for (const node of textNodes) {
    const nodeLen = node.textContent?.length || 0
    if (!startNode && preferredOffset < currentLen + nodeLen) {
      startNode = node
      startOffset = preferredOffset - currentLen
    }
    if (startNode && preferredOffset + textToFind.length <= currentLen + nodeLen) {
      endNode = node
      endOffset = (preferredOffset + textToFind.length) - currentLen
      break
    }
    currentLen += nodeLen
  }

  if (startNode && endNode) {
    const range = rangy.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    applier.applyToRange(range)
    return { range, actualText: range.toString() }
  }
  return null
}
```

- [ ] **Step 2: 物理验证跨元素选择后的恢复**
- [ ] **Step 3: 提交**

---

### Task 5: 最终集成测试与文档更新

**Files:**
- Create: `src/tests/cross-element.spec.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 编写完整的集成测试**
- [ ] **Step 2: 更新 CHANGELOG**
- [ ] **Step 3: 清理 TEMP_REQUIREMENT.md 中的 TODO**
- [ ] **Step 4: 提交**
