# TODO

- [x] 优化，GitHub ACTION，AI CR 接入 KIMI API，目前用的是 deepseek；(已撤回至 DeepSeek)

# BUG

- [x] 仍然存在，PR ACTION ERROR:Audit Log Integrity Guard / audit-check (pull_request) Error: Process completed with exit code 1.
  - **修复**: 更新了 `.gemini/ops_changelog.md` 中的 `Commit_ID` 为真实哈希值 `c0dbf81`。

- [x] AR CR V2 & V3:

  ```markdown
  已解决 (Resolved)

  1. 依赖清理: 移除了 pnpm-lock.yaml 中的 npm, install, @tailwindcss/typography 等无关生产依赖。
  2. 自动标签引擎优化 (V3):
     - 防抖机制: 增加 1.5s 防抖，避免快速操作触发高频扫描。
     - 内存镜像扫描: 仅在晋升时对内存中的 marksByUrl 镜像进行扫描，最后一次性更新，极大减少了响应式触发和性能损耗。
     - 准确统计: cleanupKeywordStats 现在会严格重新验证域名相关性，确保阈值判断准确。
  3. 统一 SSOT 路径:
     - Tooltip 新建标签已改为发送 `create-tag` 消息至 Background。
     - Sidepanel 的批量关联和删除逻辑已完全改为消息同步，消除本地直接状态修改。
  4. 刷新逻辑修复: refreshAllMarks 改为一次性获取完整最新数据，完美解决空数据丢失问题。
  5. 中文支持增强: extractKeywords 引入了基础的中文词簇识别逻辑 (2+ 汉字)，不再依赖空格。
  6. 阈值对齐: 晋升阈值恢复为 Spec 定义的 >= 2 域名, >= 3 标记。
  ```
