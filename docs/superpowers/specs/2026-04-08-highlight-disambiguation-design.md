# 设计规范：高亮恢复歧义消除 (Highlight Disambiguation) - v2

## 1. 目标 (Goal)
当网页内容发生动态变化（DOM 重排、内容微调、Shadow DOM 嵌套变化）导致原始路径失效时，通过元数据感知、指纹比对和阶梯式匹配算法准确恢复高亮，并在无法确定时引导用户交互。

## 2. 核心算法：四级阶梯恢复 (4-Level Tiered Restoration)

### Level 1: 完美物理路径 (Perfect Direct Match)
- **准则**：100% 匹配原则。
- **校验**：`rangy` 路径指向的位置必须满足 `文本完全一致` 且 `上下文指纹相似度 = 100%`。
- **目的**：确保在 DOM 结构完全未变时的极速、无误恢复。

### Level 2: 全局精确搜索 (Global Exact Search)
- **触发**：Level 1 路径漂移或失效。
- **动作**：在全文（含所有 Shadow DOM 层级）搜索所有等于原始标记文本的位置。
- **自动恢复门槛**：
    - **独苗模式**：全页面仅存一个匹配项，且指纹相似度 `>= 85%`。
    - **竞争模式**：存在多个匹配项，第一名相似度 `>= 98%` 且领先第二名 `>= 15%` 分。
- **否则**：进入 Level 4 弹窗。

### Level 3: 启发式指纹重映射 (Fuzzy Anchor Search)
- **触发**：Level 2 找不到完全匹配的原始文本（如内容被部分删除）。
- **动作**：在全文文本流中进行“双层滑动窗口比对”：
    1.  锁定与 40 字原始指纹最匹配的窗口（chunk）。
    2.  在 chunk 内部通过相似度再次微调，定位最像原标注的残余文本。
- **自动恢复门槛**：极高（`>= 98%` 且无竞争）。通常会推入 Level 4。

### Level 4: 歧义消除中心 (Disambiguation Hub)
- **动作**：弹出 UI，按“丢失任务”分组展示所有高度疑似的候选位置。
- **闭环**：用户确认后，采集 **纯净 DOM 指纹**（防止标签污染）并全量更新后台 `rangySerialized`、`shadowHostSelector` 和指纹元数据。

## 3. 物理定位技术

### 3.1 Rangy 序列化路径 (Primary)
利用 Rangy 插件生成基于字符偏移和节点索引的序列化字符串。这是系统的 **核心定位手段**，能够实现跨 Document 和 Shadow Root 的字符级还原。

### 3.2 Shadow DOM 穿透与嵌套
- **链式定位**：对于嵌套的 Shadow DOM，采集时生成 `hostSelector1|>>>|hostSelector2` 格式的递归链。
- **反序列化根**：恢复时，物理递归穿透每一层 Shadow Root，将其作为 `rangy.deserializeRange` 的本地根节点。

### 3.3 上下文选择器 (Metadata Hint)
使用 `tagName:nth-of-type(N)` 递归生成的 CSS 路径作为 **辅助定位元数据**。
- **作用**：当 Rangy 路径失效时，该选择器作为权重信号，帮助系统在全局搜索中优先锁定原始区域（Context Selector）。


## 4. 指纹防伪技术 (Context Fingerprinting)
- **采集逻辑**：不再使用模糊的 `indexOf`，而是物理计算选区在容器中的 `绝对字符偏移量` (Absolute Offset)。
- **指纹范围**：选区中心点前后各 20 字符（40 字窗口）。
- **抗污染性**：在 `handleConfirmResolution` 中，遵循“先采集指纹、后应用高亮”的时序，确保指纹数据不受 `<span>` 标签干扰。

