### TODO

- [x] 当用户选择跨元素的内容时，我们的恢复架构会出问题，如在恢复弹窗中显示异常，如恢复的内容只能单一元素的内容
- [x] 增加错误捕获、收集、导出。
- [ ] 优化，导出功能太多余，除非是多个导出，单个页面下的笔记内容直接一键复制 markdown 格式会更方便
- [ ] 优化，侧边栏，筛选功能
- [ ] 优化，模糊弹窗支持暗黑模式
- [ ] 推广，尽量名词通用化、动词化(动词即为场景)，如使用笔记而不是标记、用跳转而不是链接，结合起来就是“自带跳转功能的笔记工具，帮你快速回到原文”

### 轻微建议 (Nit): 8

1. **Nit: 错误处理可以更完善**
   - **文件**: `InteractionController.ts` 第 60-70 行
   - **建议**: `attachListenersToShadowRoots` 方法中的错误处理只打印到控制台，建议将错误收集到统一的错误收集系统中。

2. **Nit: 魔法数字**
   - **文件**: `InteractionController.ts` 第 112 行
   - **建议**: `window.setTimeout(() => this.processSelection(eventSnapshot), 50)` 中的 `50` 应该定义为常量，如 `SELECTION_DEBOUNCE_MS`。

3. **Nit: 重复的 Shadow DOM 路径解析逻辑**
   - **文件**: `MarkerApp.ts` 和 `RestorationEngine.ts`
   - **建议**: 两个文件中都有解析 `shadowHostSelector` 链的逻辑（使用 `|>>>|` 分隔符）。建议提取为共享的实用函数。

4. **Nit: 硬编码的相似度阈值**
   - **文件**: `RestorationEngine.ts` 第 126、133 行
   - **建议**: `95` 和 `80` 这些相似度阈值应该定义为配置常量，便于调整和维护。

5. **Nit: 事件监听器内存泄漏风险**
   - **文件**: `RestorationEngine.ts` 第 94-104 行
   - **建议**: 重写 `history.pushState` 但没有提供清理机制。在 SPA 应用中，如果内容脚本被多次加载，可能导致多个监听器累积。

6. **Nit: 缺少析构函数或清理方法**
   - **建议**: 类（特别是 `RestorationEngine`）监听了 DOM 和 history 事件，但没有提供 `destroy()` 或 `dispose()` 方法来清理这些监听器。

7. **Nit: 代码重复 - 高亮元素清理逻辑**
   - **文件**: `MarkerApp.ts` 第 424-436 行和 457-471 行
   - **建议**: `clearPreviewHighlight` 和 `removeMarkById` 中有相似的高亮元素清理逻辑，可以考虑提取为共享方法。

8. **Nit: 国际化考虑**
   - **文件**: `MarkerApp.ts` 第 329 行
   - **建议**: `confirm('确定要彻底丢弃此标记吗？')` 中的硬编码中文文本，对于国际化扩展不友好。
