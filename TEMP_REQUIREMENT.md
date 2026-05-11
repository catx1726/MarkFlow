# TODO

- [x] 当用户选择跨元素的内容时，我们的恢复架构会出问题，如在恢复弹窗中显示异常，如恢复的内容只能单一元素的内容
- [x] 增加错误捕获、收集、导出。

# BUG

- [ ] 知乎测试，操作：上下文中任意选中内容进行标记、保存成功，侧边栏顺序显示正常，刷新界面却弹窗恢复弹框，并且在点击“取消”按钮关掉弹框之后，向下滚动触发内容加载之后，显示在模糊弹窗中的标记又会正常自动匹配

  log：

  ```text
  [WebMarker] CONTENT SCRIPT LOADED AT TOP LEVEL index.global.js:20:60058
  [ContentScript] Initializing WebMarker... index.global.js:20:60527
  [ContentScript] Settings ready. index.global.js:20:60600
  Object { _isScalar: false, _subscribe: r(), value: {…}, __notifier: {…}, __subscription: {…} }
  content.b399ac2d.js:1:180402
  [HighlightRestorer] Restoring mark 1778481306772-hstzahy (domIndex: 8251) index.global.js:20:56207
  [WebMarker-Search] Searching ID: 1778481306772-hstzahy index.global.js:20:52283
  [HighlightRestorer] Restoring mark 1778481308706-nsvfq6a (domIndex: 8064) index.global.js:20:56207
  [WebMarker-Search] Searching ID: 1778481308706-nsvfq6a index.global.js:20:52283
  [HighlightRestorer] Restoring mark 1778481301230-1z7h8q2 (domIndex: 7269) index.global.js:20:56207
  [WebMarker-Search] Searching ID: 1778481301230-1z7h8q2 index.global.js:20:52283
  [HighlightRestorer] Restoring mark 1778481294856-8qd35d1 (domIndex: 4731) index.global.js:20:56207
  [WebMarker-Search] Searching ID: 1778481294856-8qd35d1 index.global.js:20:52283
  [HighlightRestorer] Restoring mark 1778481287180-aqg2gbo (domIndex: 3370) index.global.js:20:56207
  [WebMarker-Search] Searching ID: 1778481287180-aqg2gbo index.global.js:20:52283
  [HighlightRestorer] Restoring mark 1778481285291-0023o73 (domIndex: 1603) index.global.js:20:56207
  [WebMarker-Search] Searching ID: 1778481285291-0023o73 index.global.js:20:52283
  [HighlightRestorer] Restoring mark 1778481278903-rc3v81u (domIndex: 321) index.global.js:20:56207
  [WebMarker-Search] Searching ID: 1778481278903-rc3v81u index.global.js:20:52283
  [HighlightRestorer] Restoring mark 1778481280800-4zhcnyn (domIndex: 302) index.global.js:20:56207
  [WebMarker-Search] Searching ID: 1778481280800-4zhcnyn index.global.js:20:52283
  [WebMarker] Showing modal with 2 ambiguous marks index.global.js:20:55496
  [ContentScript] Initialization complete. index.global.js:20:61391
  [HighlightRestorer] Restoring mark 1778481306772-hstzahy (domIndex: 8251) index.global.js:20:56207
  [HighlightRestorer] Successfully restored 1778481306772-hstzahy via Rangy path index.global.js:20:56894
  [HighlightRestorer] Restoring mark 1778481308706-nsvfq6a (domIndex: 8064) index.global.js:20:56207
  [HighlightRestorer] Successfully restored 1778481308706-nsvfq6a via Rangy path index.global.js:20:56894
  [HighlightRestorer] Restoring mark 1778481301230-1z7h8q2 (domIndex: 7269) index.global.js:20:56207
  [WebMarker-Search] Searching ID: 1778481301230-1z7h8q2 index.global.js:20:52283
  [HighlightRestorer] Restoring mark 1778481285291-0023o73 (domIndex: 1603) index.global.js:20:56207
  [HighlightRestorer] Successfully restored 1778481285291-0023o73 via Rangy path index.global.js:20:56894
  ```
