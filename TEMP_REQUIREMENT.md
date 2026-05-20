# TODO

- [x] 关于展现的形式，我最开始脑子里想的是顶部展现所有标签，但这种方式不美观，也不能凸显出我们要体现的“关系”、“关联”、“层级”。你有什么更好的意见吗？

- [x] 关于自动提取标签名，我构想的是算法自动提取，我设想的场景是当用户在进行一个主题的调研时，搜索的内容、文章、网页会出现相同的关键字、词，我们只需要提取这些相同的内容，然后自动创建一个标签并且将这些内容“关联”到标签上，后期用户如果需要修改，也可以手动修改标签名称。你有什么更好的意见吗？

- [x] 关于临时标签的处理，你提的这个问题很关键，让我想起了一个前置问题，就是是否用户创建一个标记就创建一个标签？这样是否过于频繁？还是说我们应该等用户搜索的内容出现了相同的关键词之后，再创建标签？如果是这样，那么那些没有重复关键词的、没有归纳到标签下的标记应该怎么处理？回到正题，临时标签的处理我还是希望给用户以提示，就像你说的在 Tooltip 中显示一个小的标签芯片，并且支持用户手动配置是否二次弹出提示。你有什么更好的意见吗？

- [x] 标签的“多对多”展示，你这个问题也很关键，我之前没有考虑文件夹就是因为文件夹不方便多对多。回到正题，我更希望在两个标签文件夹下都看到它。你有什么更好的意见吗？

# BUG

- [x] bug，界面中已有标记点击无法正确弹出 tooltip；
  - **修复**: `src/contentScripts/index.ts` 中 `processSelection` 和 `handleMouseDown` 使用 `event.composedPath()` 获取实际点击元素，解决 Shadow DOM 内事件重定向导致 `event.target` 无法正确匹配高亮标记的问题。

- [x] bug，侧边栏无法删除标签；
  - **修复**: `src/sidepanel/Sidepanel.vue` 中 `removeTagFromAll` 在移除标记关联后，同步从 `tagsMetadata` 中删除标签本身，确保侧边栏文件夹立即消失。

- [x] bug，侧边栏，removeGroupMarks 删除标记之后没有同步更新到界面；
  - **修复**: `src/sidepanel/Sidepanel.vue` 中 `refreshAllMarks` 改用整体对象重新赋值（`marksByUrl.value = result`）触发 Vue ref 响应式更新；`removeGroupMarks` 使用 `Promise.all` 并行处理删除请求。

- [x] 优化，tooltip 样式混乱，背景色、高度压缩等等等；
  - **修复**: `src/contentScripts/views/Tooltip.vue` 中增大 `tooltipHeight` 估算值（240→340）以匹配新增标签管理区的实际高度；修复无效 `z-1` 为 `z-[9999]`；增大 textarea 最小高度并优化标签区布局避免过度压缩。

- [x] bug，侧边栏，group-header 点击 删除标记时，没有正确的同步页面更新
  - **修复**: `src/sidepanel/Sidepanel.vue` 中 `removeGroupMarks` 补充了通知 content script 移除页面高亮的逻辑（与 `removeMark` 保持一致），删除后页面标记和高亮同步消失。

- [x] 优化，color-swatch 宽高不一致，导致圆形被压扁
  - **修复**: `src/contentScripts/views/Tooltip.vue` 中将 `h-[18px] w-[20px]` 改为 `h-[18px] w-[18px]`，确保宽高一致，圆形正常显示。

- [x] 优化，侧边栏，标签 item，当标签下有标记的时候，右下、左下的圆角没有正常显示
  - **修复**: `src/sidepanel/Sidepanel.vue` 中将标签 header 和内容区统一包裹在 `rounded-lg overflow-hidden` 的父容器中，并移除内容区独立的 `rounded-b-lg` 和 `border-x border-b`，实现整个标签卡片的统一圆角。

- [x] 优化，现在侧边栏中靠近容器底部的的三点菜单弹出之后会显示不完全，被截断；
  - **修复**: `src/sidepanel/Sidepanel.vue` 中去掉了标签卡片父容器的 `overflow-hidden`（该属性会截断绝对定位的 dropdown 菜单），恢复为 header 和内容区各自独立设置 `rounded-t-lg` / `rounded-b-lg` 的组合方案；内容区背景改为实色 `bg-gray-50 dark:bg-gray-800` 并保留边框，确保圆角边界清晰可见。

- [x] 功能丢失，侧边栏，我们的单个标记的展开标记、展开备注功能丢失；