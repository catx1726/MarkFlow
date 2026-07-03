# MarkFlow v0.7.1 发布说明

**发布日期**: 2026-07-03

---

### 🛡️ 关键修复

- **修复首次同步覆盖远程数据的问题** (#51)
  - 首次连接已有 GitHub Gist 时，现在会先拉取远程数据并与本地合并，再启用自动同步，避免本地空数据覆盖云端已有数据。
  - 新增 `getGistById` 拉取完整 Gist 内容，补全 GitHub `/gists` 列表接口不返回文件内容的缺陷。
  - 重构同步队列：拆出 `performPullInternal`，避免错误恢复路径中的嵌套队列死锁。
  - 增加错误恢复冷却期（60 秒）与 `canPush` 守卫，防止失败后的重复推送覆盖远程。
  - 兼容 MV3 Service Worker：`triggerPull` 在 `webext-bridge` 超时时回退到原生 `browser.runtime.sendMessage`。

### ✨ 新增功能

- **高亮高度可配置**：Options 设置页新增"高亮行高"选项，修改后实时广播并刷新所有页面高亮。
- **恢复失败上下文提示**：当标记无法自动恢复时，Sidepanel 会展示原文上下文，帮助用户判断是否需要重新标记。
- **Options 页面体验优化**：新增粘性侧边栏导航，带滚动监听（Scroll Spy）和保存成功反馈。

### 🔧 其他修复与改进

- **Popup 用户手势保留**：直接从 Popup 调用 `chrome.sidePanel.open`，避免某些场景下侧边栏无法打开。
- **CSP 合规**：将内联主题脚本抽离为外部模块，符合扩展商店的内容安全策略要求。
- **Service Worker 兼容**：在 background 中防护 `window` 和 `chrome` 访问，提升 MV3 稳定性。
- **恢复策略简化**：移除 Level 3/4 自动恢复路径与歧义选择弹窗，降低误恢复风险。

### 📝 文档对齐

- **README / Landing Page / TECHNICAL.md**：更新恢复策略描述，明确当前仅保留 Level 1、Level 2 与 Level 2.5 自动恢复，Level 3/4 已跳过。
- **同步架构文档 (`docs/architecture/sync-mechanism.md`)**：
  - 将"加密存储"修正为"私有存储"。
  - 补全 `enqueueSync` 代码片段的 `return nextSync`。
  - 精确描述 LWW 合并策略使用 `max(createdAt, deletedAt)` 作为最后活跃时间。

---

## 安装与升级

| 平台 | 下载 |
|------|------|
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/markflow/) |
| Chrome / Edge | [extension-chromium.zip](https://github.com/catx1726/MarkFlow/releases/download/v0.7.1/extension-chromium.zip) |
| 全部版本 | [GitHub Releases](https://github.com/catx1726/MarkFlow/releases/) |

---

**Full Changelog**: [v0.7.0...v0.7.1](https://github.com/catx1726/MarkFlow/compare/v0.7.0...v0.7.1)
