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
