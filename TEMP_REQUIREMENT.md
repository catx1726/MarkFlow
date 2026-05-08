# TODO

- [x] 当用户选择跨元素的内容时，我们的恢复架构会出问题，如在恢复弹窗中显示异常，如恢复的内容只能单一元素的内容
- [x] 增加错误捕获、收集、导出。

# BUG

## DOM结构

```html
<body>
  <h1>1-2</h1>
  <div>妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111</div>
  <div>妮好 soluta illo, vero sint cumque deserunt omnis aut ratione 122AS1111112</div>
  <h1>3-4</h1>
  <div>妮好 corporis inventore aspernatur laborum amet culpa 123WE1111113</div>
  <div>妮好 repudiandae fuga Nulla 124ER1111114</div>
  <h1>5-6</h1>
  <div>妮好 t nsectetur adipisicing 125XS1111115</div>
  <div>妮好 Lorem ipnihil lquam cupiditate. 126XL1111116</div>
</body>
```

## 存在问题

- [x] 预览弹窗关闭之后颜色未恢复，点击已有标记，弹框中修改颜色，但未保存，关闭弹窗之后颜色未恢复
- [x] 标记异常，用户选中如下元素：

  ```html
  <div>妮好 t nsectetur adipisicing 125XS1111115</div>
  <div>妮好 Lorem ipnihil lquam cupiditate. 126XL1111116</div>
  ```

  工具却选中了更多的内容(选中的更多内容如下)：

  ```html
  <h1>1-2</h1>
  <div>妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111</div>
  ```

  刷新界面之后，会进入恢复弹窗(DisambiguationModal.vue)，”数据库“数据如下：

  ```json
  {
    "http://localhost:5500/2026/4M/test_markflow.html": [
      {
        "id": "1778116626883-mlo0g53",
        "url": "http://localhost:5500/2026/4M/test_markflow.html",
        "text": "妮好 t nsectetur adipisicing 125XS1111115\n    妮好 Lorem ipnihil lquam cupiditate. 126XL1111116",
        "html": "\n    <h1>1-2</h1>\n    <div>妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111</div>",
        "note": "",
        "color": "#FFFF00",
        "rangySerialized": "0/2:0,0/0/3/2:78",
        "createdAt": 1778116626884,
        "title": "Document",
        "contextTitle": "未分类笔记",
        "contextSelector": "body",
        "contextLevel": 7,
        "contextOrder": -1,
        "surroundingSnippet": "\n    1-2\n    妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111\n    妮好 soluta illo,",
        "shadowHostSelector": null
      }
    ]
  }
  ```

- [x] 恢复弹窗 hover 异常，选中：

  ```html
  <div>妮好 corporis inventore aspernatur laborum amet culpa? 123WE1111113</div>
  ```

  删除：inventore刷新界面，进入恢复弹窗，弹框内容如下：

  ```html
  <div data-v-625e1014="" class="mb-8">
    <div data-v-625e1014="" class="flex items-center justify-between mb-4 pb-2 border-b border-blue-100">
      <div data-v-625e1014="" class="flex items-center gap-2">
        <div data-v-625e1014="" class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded flex-shrink-0">
          寻找位置
        </div>
        <span data-v-625e1014="" class="text-sm font-bold text-gray-700">
          “
          <span
            style="box-shadow: inset 0 -5px 0 0 #FFFF00; cursor: pointer;"
            class="webext-highlight-1778116719728-a0ganzb"
          >
            妮好 corporis inventore aspernatur laborum amet culpa? 123WE1111113
          </span>
          ”
        </span>
      </div>
      <button
        data-v-625e1014=""
        class="flex flex-shrink-0 items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
        title="由于内容已删除，彻底移除此标记"
      >
        <div data-v-625e1014="" i-carbon-trash-can=""></div>
        彻底丢弃
      </button>
    </div>
    <div data-v-625e1014="" class="p-3 border border-gray-200 rounded mb-2 cursor-pointer transition-colors">
      <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider">3-4</div>
      <div class="text-sm text-gray-700 italic mb-1 line-clamp-2">
        "...1-2 妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111 妮好 soluta illo, vero
        sint cumque deserunt omnis aut ratione 122AS1111112 3-4 妮好 corporis aspernatur laborum amet culpa?
        123WE1111113 妮好 repudiandae fuga? Nulla 124ER1111114 5-6 妮好 t nsectetur adipisicing 125XS1111115 妮好 Lorem
        ipnihil lquam cupiditate. 126XL1111116 // &lt;![CDATA[ &lt;-- For SVG support if ('WebSocket' in window) {
        (function () { function refreshCSS() { var sheets = [].slice.call(document.getElementsByTagName("link")); var
        head = document.getElementsByTagName("head")[0]; for (var i = 0; i &lt; sheets.length; ++i) { var elem =
        sheets[i]; var parent = elem.parentElement || head; parent.removeChild(elem); var rel = elem.rel; if (elem.href
        &amp;&amp; typeof rel != "string" || rel.length == 0 || rel.toLowerCase() == "stylesheet") { var url =
        elem.href.replace(/(&amp;|\?)_cacheOverride=\d+/, ''); elem.href = url + (url.indexOf('?') &gt;= 0 ? '&amp;' :
        '?') + '_cacheOverride=' + (new Date().valueOf()); } parent.appendChild(elem); } } var protocol =
        window.location.protocol === 'http:' ? 'ws://' : 'wss://'; var address = protocol + window.location.host +
        window.location.pathname + '/ws'; var socket = new WebSocket(address); socket.onmessage = function (msg) { if
        (msg.data == 'reload') window.location.reload(); else if (msg.data == 'refreshcss') refreshCSS(); }; if
        (sessionStorage &amp;&amp; !sessionStorage.getItem('IsThisFirstTime_Log_From_LiveServer')) { console.log('Live
        reload enabled.'); sessionStorage.setItem('IsThisFirstTime_Log_From_LiveServer', true); } })(); } else {
        console.error('Upgrade your browser. This Browser is NOT supported WebSocket for Live-Reloading.'); } //
        ]]&gt;..."
      </div>
      <div class="text-base font-bold text-gray-900">妮好 corporis aspernatur laborum amet culpa? 123WE1111113</div>
    </div>
  </div>
  ```

  hover 的时候会选中：

  ```html
  <h1>1-2</h1>
  <div>妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla</div>
  ```

- [x] 恢复算法是否正常？选中

  ```html
  <div>妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111</div>
  <div>妮好 soluta illo, vero sint cumque deserunt omnis aut ratione 122AS1111112</div>
  ```

  删除：Lorem ipsum dolor LOG：

  ```json
  导航至 http://localhost:5500/2026/4M/test_markflow.html
  [WebMarker] CONTENT SCRIPT LOADED AT TOP LEVEL index.global.js:20:109256
  [ContentScript] Initializing WebMarker... index.global.js:20:109732
  [ContentScript] Settings ready. index.global.js:20:109805
  [ContentScript] Initialization complete. index.global.js:20:110199
  [WebMarker-Search] Starting generic search for ID: 1778120984579-634u1kq index.global.js:20:106818
  Object { _isScalar: false, _subscribe: r(), value: {…}, __notifier: {…}, __subscription: {…} }
  content.b399ac2d.js:1:180402
  [WebMarker-Search] Starting generic search for ID: 1778120994372-y3dertz index.global.js:20:106818
  [WebMarker-Search] Starting generic search for ID: 1778121017815-wxey8t9 index.global.js:20:106818
  [WebMarker-Search] L3 Consensus Candidate: "
    妮好  sit am`e elit. Distin..." (Sim: 92.2%) index.global.js:20:104834
  [WebMarker-Search] Starting generic search for ID: 1778121017815-wxey8t9 index.global.js:20:106818
  [WebMarker-Search] L3 Consensus Candidate: "
    妮好  sit am`e elit. Distin..." (Sim: 92.2%) index.global.js:20:104834
  ```

  删除：Lorem ipsum dolor sit am`e elit.

  LOG：

  ```json
  导航至 http://localhost:5500/2026/4M/test_markflow.html
  已重新加载
  [WebMarker] CONTENT SCRIPT LOADED AT TOP LEVEL index.global.js:20:109256
  [ContentScript] Initializing WebMarker... index.global.js:20:109732
  [ContentScript] Settings ready. index.global.js:20:109805
  [ContentScript] Initialization complete. index.global.js:20:110199
  Object { _isScalar: false, _subscribe: r(), value: {…}, __notifier: {…}, __subscription: {…} }
  content.b399ac2d.js:1:180402
  [WebMarker-Search] Starting generic search for ID: 1778120984579-634u1kq index.global.js:20:106818
  [WebMarker-Search] Starting generic search for ID: 1778120994372-y3dertz index.global.js:20:106818
  [WebMarker-Search] Starting generic search for ID: 1778121017815-wxey8t9 index.global.js:20:106818
  [WebMarker-Search] L3 Consensus Candidate: "
    妮好  Distinctio nulla rati..." (Sim: 85.5%) index.global.js:20:104834
  [WebMarker-Search] Starting generic search for ID: 1778121017815-wxey8t9 index.global.js:20:106818
  [WebMarker-Search] L3 Consensus Candidate: "
    妮好  Distinctio nulla rati..." (Sim: 85.5%) index.global.js:20:104834

  ```

  **修复说明**：
  1. **解决了搜索日志重复打印的问题**：之前由于 MutationObserver 频繁触发且未过滤已在歧义队列中的标记，导致对同一个 ID 进行循环搜索。现已增加过滤逻辑。
  2. **提升了自动恢复的准确率**：之前在比对上下文时，错误地使用了候选元素的整个 Block 内容（可能非常大）与原始 Snippet 进行比对，导致 Dice's 系数因长度差异过大而偏低，无法触发自动恢复。现已引入精准的 `surroundingSnippet`（25字符窗口）进行比对，使得即使删除部分文字，只要上下文匹配度高（>75%），即可实现自动恢复。
  3. **移除了冗余的全局 Observer**：清理了初始化时的重复监听器。
  4. **同步了弹窗显示**：确保后台恢复过程中发现的新歧义项能及时通过弹窗通知用户。

- [x] 恢复机制是正常的吗？选中：

  ```html
  <div>妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111</div>
  ```

  删除：Lorem ipsum dolor自动恢复到了更多的区域：

  ```html
  妮好 sit am`e elit. Distinctio nulla ratione amet 121QW1111111 妮好 sol
  ```

  恢复删除内容之后，恢复区域变成了：

  ```html
  sit am`e elit. Distinctio nulla ratione amet 121QW1111111 妮好 sol
  ```

  **修复说明**：
  1. **实现了“多锚点边界共识”算法 (Consensus Range)**：彻底重构了 Level 3 模糊匹配逻辑。新算法不再使用贪婪的局部对齐，而是从 Snippet 中提取多个锚点，分别对选区的“起始点”和“结束点”进行独立投票，并通过中位数聚类找出最优边界。这天然具有抗漂移能力，能够精准识别删除/增加后的剩余区域。
  2. **增加了保守更新策略**：在自动恢复时，只有当相似度 >= 90% 时才会更新数据库中的 `rangySerialized` 路径。这防止了临时的文档变动导致错误的路径被永久保存。
  3. **解决了负索引导致的恢复失败**：增加了边界检查和 Clamping，确保在文本被删除后仍能找到合法的剩余选区。
  4. **优化了验证窗口**：使用 25 字符的精准 `surroundingSnippet` 进行最终校验，极大提升了自动恢复的置信度。

- [x] 同上，选中之后删除部分内容，恢复区域变成了：

  ```html
  <h1>1-2</h1>
  <div>妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111</div>
  ```

- [x] 恢复机制，当我选中：

  ```html
  <div>妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111</div>
  ```

  删除：Lorem ipsum dolor sit am`e elit.

  目前好像没有进入恢复弹窗、也没有自动恢复？这是正常的吗？

  **修复说明**：
  1. **修复了异步同步问题**：在 `restoreHighlights` 中增加了对 `applyMarks` 的 `await` 调用。之前由于未等待搜索完成就尝试显示弹窗，导致弹窗队列为空，用户看不到恢复建议。
  2. **增强了模糊搜索的宽容度**：扩大了 `LocalAligner` 的搜索窗口（从 30 字符增加到 100 字符），使其在文本发生剧烈变动（如大段删除）时仍能精准定位剩余部分。
  3. **优化了显示逻辑**：增加了明确的日志记录，确保歧义队列中的标记能及时触发弹窗显示。

- [x] 恢复机制，当我选中：

  ```html
  <div>妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111</div>
  ```

  删除：Lorem ipsum dolor sit am`e elit.

  打开了恢复弹窗，但是恢复弹窗的项目内容内容不对：

  ```html
  <div>妮好 Distinctio nulla ratione amet 121QW1111111</div>
  <div>妮好 soluta illo,....未选中的忽略内容....</div>
  ```

  **修复说明**：
  1. **实现了“双向共识边界”预测**：重构了 `ConsensusAnchorManager`，使其能同时通过锚点投票预测选区的起始点和结束点。这比之前仅预测起始点再向后延伸的方法更精准，有效防止了因长度差异导致的过度延伸。
  2. **引入了“块级边界感应”约束**：在 `LocalAligner` 中引入了结构化边界校验。如果搜索路径试图跨越一个块级元素（如 `div`, `p`），系统会校验该元素的起始文本是否包含在原始标记文本中。如果不包含，则强制停止延伸。这完美解决了“贪婪匹配”导致误入下一个节点的问题。
  3. **优化了局部对齐窗口**：将对齐搜索范围收窄到预测边界附近的 ±40 字符，在保证灵活性的同时极大降低了误匹配的概率。

- [x] PR ACTION 报错：Error: Process completed with exit code 1.

  ```TEXT
  Run # 提取除文档和配置外的所有代码变更文件
  # 提取除文档和配置外的所有代码变更文件
  CHANGES=$(git diff --name-only origin/main...HEAD | grep -vE '^(\.github/|openspec/|README\.md|ARCHITECTURE\.md|GETTING_STARTED\.md|docs/)' || true)

  if [ -n "$CHANGES" ]; then
    # 如果有代码变更，强制检查 ops_changelog.md 是否在本次提交中
    LOG_CHANGED=$(git diff --name-only origin/main...HEAD | grep '\.gemini/ops_changelog\.md')

    if [ -z "$LOG_CHANGED" ]; then
      echo "❌ **物理熔断**: 检测到代码变更，但未在 .gemini/ops_changelog.md 中提交审计日志！"
      echo "请记录变更意图与 Undo_CMD。"
      exit 1
    fi
    echo "✅ **合规**: 操作审计记录已存在。"
  else
    echo "ℹ️ 本次 PR 无代码变更（仅文档/配置），跳过审计日志检查。"
  fi
  shell: /usr/bin/bash -e {0}
  ```

- [x] AI CR 严重问题

  ```markdown
  严重问题 (Blocking)

  1. HighlightRestorer 与 ContentChangeMonitor 职责边界模糊，存在逻辑重复

     文件: src/contentScripts/restorer.ts 和 src/contentScripts/monitor.ts

     问题描述: 根据 PR 描述和 monitor.ts 的代码，ContentChangeMonitor 负责监听 DOM 变化和 SPA 导航，并调用 restoreCallback。然而，monitor.ts 中的 debouncedRestore 方法直接管理了 state.isRestoring 标志位。同时，restorer.ts 中也存在一个 debouncedRestore 方法，并且也管理了 state.isRestoring 标志位（虽然未在 index.ts 中直接调用，但作为公共方法存在）。核心问题: 恢复的触发（由 Monitor 负责）和恢复的执行（由 Restorer 负责）之间的边界不清晰。Monitor 不应该直接管理 isRestoring 状态，这应该是 Restorer 的职责。这导致了职责重复和潜在的状态管理冲突。例如，如果未来有其他地方直接调用 restorer.restoreHighlights()，它并不会设置 isRestoring 标志，这与通过 monitor 触发的行为不一致。

     建议修改: ContentChangeMonitor 应仅负责“监听”和“触发”。它不应关心 isRestoring 标志。它的 debouncedRestore 方法应该简单地调用 this.restoreCallback()。HighlightRestorer 应完全负责恢复逻辑，包括 isRestoring 标志的管理。restorer.ts 中的 debouncedRestore 方法应被移除或标记为 private，并且其逻辑应合并到 restoreHighlights 方法中，或者作为 restoreHighlights 的一个内部包装器。monitor 的回调应直接指向 restorer.restoreHighlights 或一个内部包装方法。

     // monitor.ts (修改后) private debouncedRestore() { clearTimeout(this.debounceTimer) this.debounceTimer = window.setTimeout(async () => { // 不再管理 isRestoring await this.restoreCallback() }, 300) as unknown as number }

     // restorer.ts (修改后) async restoreHighlights() { if (this.state.isRestoring) return // 防重入 this.state.isRestoring = true try { // ... 原有的恢复逻辑 ... } finally { this.state.isRestoring = false } }

     // index.ts (修改后) const monitor = new ContentChangeMonitor(state, () => restorer.restoreHighlights())

     严重性: 这是架构设计上的缺陷，可能导致难以追踪的并发问题和状态不一致。必须修改 (Blocking)。

  2. UIManager 对 HighlightRestorer 的依赖是循环依赖的潜在源头

     文件: src/contentScripts/ui.ts 和 src/contentScripts/index.ts

     问题描述: 在 index.ts 中，UIManager 的构造函数接收了 restorer.restoreHighlights 和 restorer.scrollToMark 的回调。这本身是一种解耦手段，但同时也暗示了 UIManager 不应该直接依赖 HighlightRestorer 类。然而，UIManager 的 handleInitialLoadActions 方法直接调用了 this.\_restoreHighlights?.()。这创建了一个隐式的、不稳定的依赖关系。如果未来 HighlightRestorer 的接口发生变化，UIManager 也需要跟着改变。

     建议修改: 更好的做法是让 index.ts 或一个更高层次的协调者（Coordinator）来编排这些操作。UIManager 应该只负责 UI 相关的逻辑。handleInitialLoadActions 中的恢复和滚动逻辑应该由 index.ts 的 initialize 函数来编排。将 handleInitialLoadActions 方法从 UIManager 中移除，并将它的逻辑放回 index.ts 的 initialize 函数中。

     // index.ts (修改后) async function initialize() { // ... 初始化代码 ... ui.ensureMounted() window.addEventListener('keydown', handleKeyDown) attachListenersToShadowRoots(document)

     // 编排初始化动作 await restorer.restoreHighlights() await ui.handleInitialLoadScroll() // 仅处理滚动逻辑

     monitor.setupGlobalObserver() monitor.setupBodyObserver() monitor.setupSPAListener() console.log('[ContentScript] Initialization complete.') }

     严重性: 这是一个设计问题，虽然当前没有产生循环依赖，但会降低代码的灵活性和可测试性。建议修改 (Blocking)。
  ```

- [x] AI CR:

  ```markdown
  严重问题 1: ContentChangeMonitor 缺少对 isRestoring 的保护检查

  在restorer.ts的restoreHighlights()中，开头有if (this.state.isRestoring) return的保护检查，但在monitor.ts的debouncedRestore()中，没有检查isRestoring状态。这可能导致恢复操作正在进行时，新的DOM变更又触发另一次恢复，造成竞态条件。

  原始代码中debouncedRestore有if (isRestoring) return检查（见原始代码L856），但在重构后的monitor.ts中丢失了。

  // monitor.ts - 当前实现 private debouncedRestore() { clearTimeout(this.debounceTimer) this.debounceTimer = window.setTimeout(async () => { await this.restoreCallback() // 没有检查 isRestoring }, 300) as unknown as number }

  建议: 添加isRestoring检查，或通过回调传递状态：

  private debouncedRestore() { clearTimeout(this.debounceTimer) this.debounceTimer = window.setTimeout(async () => { // 检查恢复是否正在进行 if (this.state?.isRestoring) return await this.restoreCallback() }, 300) as unknown as number }

  严重问题 2: ShadowDOMManager 中的 DOMSelector 和 DOMScanner 引用可能不存在

  在shadowDom.ts中，引用了./dom模块的DOMSelector和DOMScanner：

  import { DOMSelector, DOMScanner } from './dom'

  但根据src/logic/dom.ts的现有封装风格，这些类名需要确认是否确实存在。如果dom.ts中导出的是getElementSelector和querySelectorDeep函数而非类方法，这将导致运行时错误。

  建议: 检查dom.ts的实际导出内容，确保导入的类/方法名称正确。如果导出的是函数，应直接导入函数而非类。

  严重问题 3: handleInitialLoadActions 中的 scrollToMark 调用方式改变

  原始代码中handleInitialLoadActions是await调用的：

  async function handleInitialLoadActions() { try { await restoreHighlights() // ... scrollToMark } }

  重构后，在index.ts中改为：

  await restorer.restoreHighlights() // ... scrollToMark 直接内联

  虽然逻辑等价，但错误处理范围改变：原始代码中restoreHighlights和scrollToMark在同一个try-catch块中，重构后scrollToMark的setTimeout回调中的错误将不会被捕获。

  建议: 为内联的scrollToMark逻辑添加错误处理：

  await restorer.restoreHighlights() { const hash = window.location.hash if (hash.startsWith('#**highlight-mark**')) { const markId = hash.substring('#**highlight-mark**'.length) if (markId) { setTimeout(() => { try { restorer.scrollToMark(markId) history.replaceState(null, '', window.location.pathname + window.location.search) } catch (error) { console.error('Error during scroll to mark:', error) } }, 100) } } }
  ```

- [x] 恢复机制，当我选中：

  ```html
  <div>妮好 Lorem ipsum dolor sit am`e elit. Distinctio nulla ratione amet 121QW1111111</div>
  ```

  删除：Lorem ipsum dolor sit am`e elit.

  刷新界面，弹出恢复弹框，hover 一个项目，会瞬间增加多个重复的项目
