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

### 🏗️ 架构与代码质量

- **过滤逻辑纯函数化**：将 `filterTagTree` 与 `isMarkMatch` 抽离到独立的 `searchFilter.ts`，避免测试环境加载 `webextension-polyfill`。
- **状态分离**：在 `useSidepanelData` 中分离实时输入 `searchQuery` 与防抖过滤状态 `debouncedSearchQuery`，响应式逻辑更清晰。
- **测试共享化**：提取 `buildSampleTree` 等测试辅助函数到 `testUtils.ts`，减少测试文件间重复。

### 📝 文档与审计

- 新增 Spec：`docs/superpowers/specs/2026-07-03-sidepanel-search-design.md`
- 新增 Plan：`docs/superpowers/plans/2026-07-03-sidepanel-search-plan.md`
- 更新审计日志：`.gemini/ops_changelog.md`
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
