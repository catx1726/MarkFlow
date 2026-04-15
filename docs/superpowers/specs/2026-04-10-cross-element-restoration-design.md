# 📐 跨元素高亮恢复与歧义消除设计规范 (Cross-Element Restoration Design)

## 1. 需求背景 (Problem Statement)

### 1.1 核心问题
当前标记恢复架构在处理**跨元素 (Cross-Element)** 高亮时存在局限性：
- **搜索失效**: `findCandidateElements` 仅将第一个文本节点的直接父元素作为“候选容器”，当高亮跨越多个块级元素（如多个 `<p>` 或 `<div>`）时，该容器无法容纳完整高亮，导致后续的 `Range` 重建失败。
- **UI 截断**: `DisambiguationModal` 弹窗中展示的候选内容仅限于起始容器内的文字，用户无法看到完整的高亮内容，导致无法做出正确判断。

### 1.2 预期行为
- 搜索算法应能识别高亮所跨越的所有节点。
- `candidateElement` 应自动扩展为能包含所有相关节点的**最小公共祖先 (Least Common Ancestor)**。
- 弹窗和恢复逻辑应能完美处理跨越多个 DOM 节点的文本流。

---

## 2. 方案详述 (Design Details)

### 2.1 核心搜索逻辑重构 (`src/logic/search.ts`)
- **跨度识别**: 在扫描 `fullText` 时，根据匹配到的 `matchIndex` 和原始 `mark.text.length`，确定所有涉及的 `TextNode`。
- **公共祖先计算**: 
  - 实现一个 `findCommonAncestor(nodes: Node[]): HTMLElement` 函数。
  - 对于找到的匹配跨度，计算其所有涉及文本节点的最小公共父元素。
- **候选者创建 (`createCandidate`)**:
  - `candidateElement` 更新为计算出的公共祖先。
  - `matchIndex` 转换为相对于该公共祖先容器起始点的本地偏移量。

### 2.2 恢复与高亮应用增强 (`src/contentScripts/index.ts`)
- **`applyPreciseHighlight` 深度化**:
  - 必须递归获取 `candidateElement` 下的所有文本节点。
  - 支持跨节点边界进行 `Range` 切片和 `applier.applyToRange()` 操作。
- **歧义弹窗内容完整化**:
  - `displayTextSnippet` 应基于 `fullText` 的切片，而不是单个容器的 `textContent`。
  - 确保渲染时能体现出跨元素的连续性（哪怕中间有 DOM 标签）。

### 2.3 健壮性保障
- **边界空格处理**: 严格对齐 Rangy 的序列化/反序列化逻辑，确保 `fullText` 拼接时不会丢失或多出块级元素间的换行符/空格。
- **相似度得分优化**: 在计算 `similarityScore` 时，引入上下文指纹 (Context Fingerprint) 进行加权，防止在复杂 DOM 结构中误报。

### 2.4 标记进化与自愈机制 (Self-healing Mechanism)
- **自愈逻辑**: 当用户通过 `DisambiguationModal` 手动确认了一个由于页面变动（如部分删除）导致的“非完美匹配”位置后，系统将自动执行“标记进化”。
- **属性更新**: 确认后，数据库中的 `mark.text`, `mark.html`, `mark.rangySerialized` 以及上下文指纹（`surroundingSnippet`）将同步更新为当前页面的实际状态。
- **持久化影响**: 
  - 这种行为将标记锚定在最新的页面结构上，确保下次加载时能通过最快的 Level 1 (路径还原) 路径恢复，而不再弹出确认窗口。
  - **副作用**: 如果页面内容后续被恢复（如撤销删除），标记将保持在“进化后”的缩减状态，除非再次触发歧义搜索并由用户重新确认。
- **设计权衡**: 优先保证“不打扰用户（减少重复弹窗）”的体验，允许标记根据页面生命周期动态调整其定义的“真相”。

### 2.5 动态页面加固方案 (Dynamic Page Reinforcement)
针对 Bilibili, Reddit 等虚拟列表页面，引入以下机制：
- **全局搜索回退 (Level 2.5)**: 当标记记录的旧宿主容器失效（内容漂移或容器复用）时，系统自动启动全文档范围的文本搜索，确保漂移后的节点依然能被找回。
- **3s 失败冷却**: 为了防止在动态滚动时产生无限报错，搜索失败的标记将进入 3 秒冷却期。
- **正则模糊匹配**: 搜索逻辑支持 `\s` 和 `\u200b` (零宽字符) 忽略，穿透因表情包或动态标签切割的文本碎片。
- **迭代式 DOM Walker**: 将 `getAllTextNodes` 从递归改为基于栈的迭代，适配超深度 DOM 结构并显著提升 B 站等长页面的搜索性能。

---

## 3. 架构影响 (Architectural Impact)

### 3.1 模块关系
- **`logic/search.ts`**: 核心职责从“单节点父级定位”扩展为“跨节点跨度定位”。
- **`contentScripts/index.ts`**: 高亮应用逻辑从“依赖父容器直接查找”转变为“基于跨度索引全局重建”。

### 3.2 数据结构变化
- `Candidate` 接口中的 `matchIndex` 将明确其基准（本地 vs 全局），并增加对跨度边界的记录。

---

## 4. 验证标准 (Success Criteria)

### 4.1 核心链路验证
- [ ] 跨越两个相邻 `<p>` 标签的高亮在刷新页面后能成功恢复。
- [ ] 当跨元素路径失效时，`DisambiguationModal` 弹出的预览文字能显示完整的高亮内容（包括跨越两个元素的部分）。
- [ ] 用户在弹窗确认后，新生成的 Rangy 序列化路径能正确持久化回后台。

### 4.2 性能与安全
- [ ] 即使 `candidateElement` 较大（如整个 `section`），搜索性能依然稳定在 200ms 以内。
- [ ] 跨元素操作不引入 XSS 风险，所有 HTML 渲染均经过转义或受控展示。

---
*YOU-DRIVE-SOP - 驱动规约，掌握智力。*
