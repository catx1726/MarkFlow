# MarkFlow v0.7.2 发布说明（草稿）

**发布日期**: 待定

---

### ✨ 新增功能

- **侧边栏常驻搜索** (#52)
  - 在 `SidepanelHeader` 顶部新增搜索框，支持按关键词过滤标记、页面和标签。
  - 搜索命中后默认保留完整 page 上下文，同页其他标记一并展示，便于用户确认上下文。
  - 新增"仅显示匹配项"开关，开启后仅展示命中的标记，满足紧凑浏览需求。
  - 多关键词默认 AND 匹配，支持 mark 文本、note、page 标题、tag 名称等字段。
  - 输入防抖 150ms，避免频繁过滤造成卡顿。

- **新建标签交互优化**
  - 将原有常驻的新建标签输入框折叠为 "+" 按钮，点击后展开输入框。
  - 创建成功后自动收起，为搜索框释放顶部空间。

- **标签记忆：新建标记默认预选上次标签** (#55)
  - 新建标记时，Tooltip 自动预选上一次新建标记所选的标签集合——批量整理一篇长文到同一课题时无需反复点选同一标签。
  - "空选保存也记空"：保存一个不选任何标签的新标记会清空记忆，作为显式的重置入口（无需额外按钮）。
  - 仅"新建"分支更新记忆；编辑已有标记仍使用该标记原标签，互不影响。
  - 标签被删除后，悬空的标签 id 在预选时由 `filterExistingTags` 自动过滤，不会出现 ghost 选中。
  - 记忆为本地偏好（不参与 Gist 同步），与默认高亮色同级。

### 🐛 问题修复

- **GitHub Gist 同步间歇性自动断开** (commit `420e2c4`)
  - **症状**：开启 Gist 同步后，设置页时不时弹出"身份验证失败或权限不足，请检查 Token 配置"，同步被自动关闭，需手动重连才能恢复。
  - **根因**：GitHub API 返回 403（主/次级速率限制、滥用检测、或网络代理/GFW 拦截）时，被错误地等同于 401 认证失败处理，触发了"自动禁用同步"的自我熔断逻辑——而 Token 本身始终有效。
  - **修复**：
    - 新增 `GitHubAPIError` 分类器，读取响应体与 `X-RateLimit-Remaining` / `Retry-After` 头，将错误细分为 `auth` / `rate-limit` / `not-found` / `storage-limit` / `unknown` 五类。
    - **速率限制不再关闭同步**：改为进入退避期（遵守 `Retry-After`，缺省 60 秒），期间跳过推送但同步保持开启，到期自动恢复。
    - 只有确认的认证类错误（真实 401，或明确的权限 403）才会自动禁用同步。
    - 设置页报错信息现在会显示真实原因（如"GitHub 请求频率受限，请 X 秒后重试"），下次再遇到问题可一眼定位是速率限制还是 Token 失效。
  - 新增 9 个单元测试覆盖错误分类逻辑（`sync.spec.ts` 由 16 增至 25 个用例）。

### 🏗️ 架构与代码质量

- **无限滚动页面恢复性能优化** (commit `7ffb9ff`)
  - `monitor.ts` 以 `subtree:true` 监听 `document.body`，导致 Twitter/Reddit/B 站等无限滚动页面下 `restoreHighlights` 每 300ms 触发一次完整扫描（跨上下文消息往返 + 每个已恢复标记一次 Shadow DOM 查询）。
  - 在 `HighlightRestorer` 引入"恢复完成早退 + 5s 重验窗"：本页所有标记恢复完成后，monitor 触发的 restore 在窗内直接跳过消息往返；超过 5s 放行一次完整 pass 以捕获虚拟列表回收导致的标记丢失。
  - 完成态封装在 restorer 实例内不污染共享 state；`refreshHighlights` 手动全量重扫会重置该状态。
  - 净效果：连续滚屏期间 restore 调用频率从约每 300ms 降至约每 5s（约 16× 降频）。新增 3 个 TDD 用例（restorer.spec 5→8）。
- **过滤逻辑纯函数化**：将 `filterTagTree` 与 `isMarkMatch` 抽离到独立的 `searchFilter.ts`，避免测试环境加载 `webextension-polyfill`。
- **状态分离**：在 `useSidepanelData` 中分离实时输入 `searchQuery` 与防抖过滤状态 `debouncedSearchQuery`，响应式逻辑更清晰。
- **测试共享化**：提取 `buildSampleTree` 等测试辅助函数到 `testUtils.ts`，减少测试文件间重复。

### 📝 文档与审计

- 新增 Spec：`docs/superpowers/specs/2026-07-03-sidepanel-search-design.md`
- 新增 Plan：`docs/superpowers/plans/2026-07-03-sidepanel-search-plan.md`
- 更新审计日志：`.project/ops_changelog.md`
- 更新 NIT Roadmap：`docs/NIT_ROADMAP.md`

---

## 安装与升级

| 平台 | 下载 |
|------|------|
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/markflow/) |
| Chrome / Edge | [extension-chromium.zip](https://github.com/catx1726/MarkFlow/releases/download/v0.7.2/extension-chromium.zip) |
| 全部版本 | [GitHub Releases](https://github.com/catx1726/MarkFlow/releases/) |

---

**Full Changelog**: [v0.7.1...v0.7.2](https://github.com/catx1726/MarkFlow/compare/v0.7.1...v0.7.2)
