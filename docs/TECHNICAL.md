# MarkFlow 技术实现

MarkFlow 当前采用 **Rangy 路径还原** 为主、**内容搜索共识** 为辅的恢复策略：高亮创建时记录 DOM 序列化路径与上下文指纹，恢复时优先按路径还原；路径失效后回退到局部/全局内容搜索，结合上下文相似度校验确定候选；若仍无法恢复，则在侧边栏保留失败上下文供用户手动确认。同时，通过 GitHub Gist 提供可选的多端同步能力，并采用 Local-first 设计确保离线可用。

## 核心流程

1. **路径记录**: 高亮创建时，使用 Rangy 记录序列化路径，并提取标题、章节、上下文片段等指纹信息。
2. **路径还原**: 页面再次打开时，优先按保存的序列化路径还原高亮，并校验内容/上下文相似度。
3. **搜索回退**: 路径失效时，在局部容器或全文档范围内搜索候选文本，结合上下文相似度判断唯一性。
4. **失败兜底**: 当自动恢复失败时，记录 `restoreFailedAt` 并在侧边栏展示原文上下文，由用户决定是否重新标记。

## 当前恢复层级

| 层级 | 名称 | 逻辑 | 自动恢复门槛 | 目的 |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1** | **路径还原** | Rangy 序列化路径还原 + 上下文指纹校验 | 内容相似度 >= 95% 且上下文相似度 >= 80% | 极速无感恢复，性能最优 |
| **Level 2** | **内容对齐** | 局部/正则精确搜索 | 唯一项且共识得分 >= 85 | 元素位置漂移，但内容未变 |
| **Level 2.5** | **全局回退** | 全文档回退搜索 | 唯一项且共识得分 >= 85 | 解决虚拟列表导致的容器复用 |

**关于 Level 3/4**: 早期设计曾包含共识重构（Level 3）与歧义消除 UI（Level 4），用于处理内容增删后的模糊恢复。但在当前版本中，为降低复杂度和误恢复风险，这两级被有意跳过。当自动恢复失败时，系统会在标记上记录 `restoreFailedAt` 并在侧边栏展示上下文，由用户决定是否手动重新标记。详见 `SPEC-2026-06-26-001`。

> 当共识得分 >= 90 时，自动更新数据库中的序列化路径，防止临时文档漂移导致永久错位。

## 数据模型

从单一按网页平铺，演进为 **"标签/课题 → 网页 → 标记分组"** 的三级树状结构：

```
收集箱 / 前端优化 / 算法题解 / 设计模式 ...
  └── https://example.com/article
        └── 第一章：概述
              ├── > 关键概念 A
              └── > 关键概念 B
```

- `Mark.tags`: 支持多标签关联的字符串数组
- `Tag`: 包含颜色、创建时间的独立元数据对象
- `syncConfig` / `syncStatus`: 同步配置与状态（token、gistId、enabled、lastSyncStatus 等）
- `useWebExtensionStorage`: 全链路响应式同步，确保 Sidepanel、Background、Content Script 三方数据一致

## 同步机制（GitHub Gist）

同步是可选功能，默认完全本地。开启后：

- 数据以私有 Gist 中的 `markflow_sync.json` 文件为载体。
- 通过 `getGistById` 读取完整文件内容（GitHub `/gists` 列表接口不返回 content）。
- `performPullInternal` 负责拉取与合并，`performPush` 负责推送，二者通过 `enqueueSync` 串行化。
- 首次连接采用 **pull-then-enable** 顺序：先拉取并合并远程数据，再设置 `enabled = true`，防止本地空数据覆盖云端。
- 错误恢复：推送前若 `lastSyncStatus === 'error'`，先执行一次拉取合并，并引入 60 秒冷却期避免循环。
- MV3 兼容：`triggerPull` 使用 `webext-bridge` + `browser.runtime.sendMessage` 双通道 fallback，并显式传递 token/gistId 以避免跨 context storage 同步延迟。

详见 [同步机制深度解析](./architecture/sync-mechanism.md)。

## 极端环境适配

- **3s 恢复冷却**: 当全局搜索失败时，该标记进入 3 秒静默期，防止虚拟列表滚动时的循环重试。
- **正则模糊匹配**: 搜索算法自动忽略 `\n`、多空格及零宽不可见字符，穿透碎片化的文本节点。
- **迭代式 DOM 遍历**: 放弃递归改用"栈"遍历，轻松处理超大 DOM 结构。
- **Payload 大小监控**: 同步前检查数据包大小，超过 8MB 时记录警告，接近 GitHub 10MB 上限时提示用户清理。

## 工程标准

- [代码质量标准 (Clean Code)](./standards/code-standards/README.md)
- [测试驱动开发 (TDD)](./standards/test-driven-development.md)
- [API 设计规范](./standards/api-design-standards.md)
- [安全与日志标准](./standards/security-standards.md)
- [环境与配置标准](./standards/environment-standards.md)
