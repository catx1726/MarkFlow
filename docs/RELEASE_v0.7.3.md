# MarkFlow v0.7.3 发布说明

**发布日期**: 2026-07-29

---

### 🐛 问题修复

- **Tooltip 创建标签后第二次点击无响应** (#59)
  - **症状**：在 Tooltip 中点击“创建”按钮新增一个标签后，再次点击“创建”或选择其他标签时没有任何反应；按 Enter 键或重新打开 Tooltip 后可能恢复。
  - **根因**：创建标签后，前端会异步调用 `get-all-tags` 重新拉取全部标签。在第二次创建时，这条消息会在 content script 与 background 之间卡住，导致 UI 无法得到反馈，表现为按钮无响应。
  - **修复**：不再依赖 `get-all-tags` 回环，而是直接使用 `create-tag` 返回的权威 Tag 对象更新本地标签列表和选中状态，彻底消除消息卡死路径。
  - **体验优化**：创建成功后按钮会短暂显示绿色“已创建”提示，持续 1.5 秒后恢复为“创建”。
  - 影响文件：`src/contentScripts/views/Tooltip.vue`、`src/contentScripts/index.ts`、`src/background/main.ts`

### 🧹 代码清理

- 移除 PR #59 调试阶段遗留的所有 `[DIAG]` 诊断日志，恢复生产代码整洁度。
- 补录 PR #59 操作审计日志到 `.gemini/ops_changelog.md`。

---

## 安装与升级

| 平台 | 下载 |
|------|------|
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/markflow/) |
| Chrome / Edge | [extension-chromium.zip](https://github.com/catx1726/MarkFlow/releases/download/v0.7.3/extension-chromium.zip) |
| 全部版本 | [GitHub Releases](https://github.com/catx1726/MarkFlow/releases/) |

---

**Full Changelog**: [v0.7.2...v0.7.3](https://github.com/catx1726/MarkFlow/compare/v0.7.2...v0.7.3)
