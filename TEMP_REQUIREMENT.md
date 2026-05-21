# TODO

- [x] 优化，GitHub ACTION，AI CR 接入 KIMI API，目前用的是 deepseek；(已撤回至 DeepSeek)

# BUG

- [x] 仍然存在，PR ACTION ERROR:Audit Log Integrity Guard / audit-check (pull_request) Error: Process completed with exit code 1.
  - **修复**: 更新了 `.gemini/ops_changelog.md` 中的 `Commit_ID` 为真实哈希值 `e7d13b0`。

- [x] 移除自动逻辑与架构重构 (根据最新反馈):
  - **移除自动逻辑**: 已完全移除“自动生成标签”和“自动关联标签”的相关统计、晋升及后台扫描逻辑（删除 `association.ts`）。
  - **统一 SSOT 路径**: 
    - 侧边栏的标签创建、重命名、删除操作现在全部通过 `sendMessage` 由 Background 统一处理并触发持久化。
    - Tooltip 的标签创建也改为消息驱动，并改为从后台动态获取最新标签列表（`get-all-tags`）。
  - **修复数据一致性**: Sidepanel 的批量管理逻辑现已完全采用消息同步，消除本地直接修改 `marksByUrl` 的隐患。
  - **性能优化**: 彻底移除了高开销的全量扫描逻辑。
