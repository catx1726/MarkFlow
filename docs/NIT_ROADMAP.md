# MarkFlow 后续迭代建议 (基于 AI CR NIT 项目分析)

本文档总结了 PR #37 (内容关联与标签系统)、PR #41 (GitHub Gist 同步) 以及 PR #45 (存储竞态修复) 中 AI 提出的轻微建议 (NIT)，并对其修改价值进行了深度评估，作为后续迭代的 Roadmap 参考。

---

## 1. 架构与性能类 (High Value)

| 建议项目 | 来源 | 成本 | 收益 | 推荐等级 | 评估理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sidepanel 逻辑拆分 (Composables)** | PR #37 | 中 | 高 | [已完成] | 成功将 800+ 琛?Sidepanel.vue 拆分为 5 个 Composables 和 5 个组件。 |
| **`structuredMarks` 性能优化 (shallowRef)** | CR #47 | 低 | 中 | ⭐⭐⭐⭐ | `structuredMarks` 是大型嵌套对象，使用 `shallowRef` 替代 `ref` 可避免深度响应式追踪开销。 |
| **URL 规范化逻辑提取 (Dedupe)** | CR #47 | 低 | 中 | ⭐⭐⭐⭐ | `getNormalizedUrl` 在多处重复定义。提取到共享的 `~/logic/url.ts` 可提升一致性。 |
| **样式辅助函数提取 (StyleHelpers)** | CR #47 | 低 | 低 | ⭐⭐⭐ | 将 `PageSection.vue` 中的 `getLevelClass` 等纯样式逻辑提取为通用工具，符合 DRY 原则。 |
| **`ensureReady` 守卫解耦** | PR #45 | 中 | 高 | ⭐⭐⭐⭐ | 将守卫逻辑提取到独立模块，方便只读操作复用及单元测试直接引用，减少代码重复。 |
| **ContentScripts 高亮元数据提取统一化** | 分析 | 中 | 高 | ⭐⭐⭐⭐ | `restorer.ts` 与 `ui.ts` 中存在 3 段几乎相同的 ShadowHost 构建/Rangy 序列化/上下文提取逻辑。提取为 `extractMarkPayload` 纯函数，可减少 60-80 行重复代码。 |
| **ContentScripts DOM 清理逻辑统一化** | 分析 | 低 | 中 | ⭐⭐⭐⭐ | `unwrapHighlightElements(selector)` 逻辑在 `ui.ts` 和 `restorer.ts` 中重复 4 次。提取为共享工具函数，降低后续维护遗漏风险。 |
| **i18n 国际化基础框架** | PR #41 | 中 | 中 | ⭐⭐⭐⭐ | 错误消息目前是硬编码中文。建立标准 i18n 体系是走向社区的基础。 |
| **数据精简与字段剥离** | 讨论 | 高 | 高 | ⭐⭐⭐⭐ | 剥离冗余的上下文信息，比压缩算法更能提升系统健康度，且保持数据可读性。 |
| **统一消息返回格式** | PR #37 | 中 | 中 | ⭐⭐⭐⭐ | 统一 `{success, data, error}` 格式可简化前端错误处理模板。 |
| **search.ts `structureBoundaries` 单遍历构建** | 分析 | 中 | 高 | ⭐⭐⭐⭐ | `createSearchContext` 中对每个块级元素都调用 `getAllTextNodes(el)`，导致同一子树被反复扫描，形成 O(n²) 开销。改为一次遍历同时收集文本节点和结构边界。 |
| **search.ts 去重键替换 `innerHTML`** | 分析 | 低 | 中 | ⭐⭐⭐⭐ | `findCandidateElements` 使用 `candidateElement.innerHTML` 作为 Map 去重键，会触发同步 DOM 序列化。建议改用元素引用或稳定标识符。 |
| **shadowDom.ts 与 ContentScripts 去重** | 分析 | 低 | 中 | ⭐⭐⭐ | `buildShadowHostSelector` / `resolveShadowHost` 的逻辑在 `contentScripts/ui.ts` 和 `restorer.ts` 中也有几乎相同的实现。统一收口到 `shadowDom.ts`。 |

## 2. 可观测性与监控类 (New Priority)

| 建议项目 | 来源 | 成本 | 收益 | 推荐等级 | 评估理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **高亮恢复失败统计** | 讨论 | 中 | 极高 | [已完成] | 目前恢复失败仅在控制台打印 warn。通过 `collectError` 采集失败 URL 和原因，可帮助开发者优化搜索算法。 |
| **本地存储配额监控** | 讨论 | 低 | 中 | [已完成] | 虽然开启了 `unlimitedStorage`，但部分浏览器环境仍有限制。主动采集存储占用数据可预防极端崩溃。 |
| **同步 Payload 大小预警** | 讨论 | - | - | [已完成] | 已在 `src/background/main.ts` 中实现实时监控与日志采集。 |

## 3. UI/UX 体验类 (Medium Value)

| 建议项目 | 来源 | 成本 | 收益 | 推荐等级 | 评估理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **增加 `buildTagTree` 单元测试** | PR #37 | 中 | 高 | ⭐⭐⭐⭐ | 这是侧边栏展示的核心逻辑，逻辑较复杂，增加测试能防止树结构坍塌。 |
| **格式化与功能改动分离** | PR #45 | 中 | 中 | ⭐⭐⭐ | 严格区分纯格式化提交与功能修复提交，降低审查认知负荷，防止回滚时产生副作用。 |
| **Token 自动重连机制** | 讨论 | 中 | 中 | ⭐⭐⭐ | 针对 401 错误区分“暂时性网络故障”与“永久性失效”，提升连通率。 |
| **日志记录器 (Logger) 封装** | PR #41 | 中 | 中 | ⭐⭐⭐ | 统一管理日志，支持生产环境自动静默，解决 `console.log` 滥用与 Lint 冲突。 |
| **类型安全增强 (Protocol Types)** | PR #37 | 中 | 中 | ⭐⭐⭐ | 为所有消息定义明确的 Payload 接口，减少弱断言使用。 |
| **清理未使用的 Prompt.vue 组件** | UI Review | 低 | 中 | [已完成] | `src/contentScripts/views/Prompt.vue` 无任何引用，且使用纯手写 CSS 与项目风格脱节，建议直接删除以减少维护负担。 |
| **DisambiguationModal.vue 暗黑模式适配** | UI Review | 低 | 高 | [已完成] | 搜索框、列表、底部背景均未适配暗黑模式，与 Tooltip 的精致感形成反差。 |
| **Popup 视觉层次与品牌感优化** | UI Review | 低 | 中 | [已完成] | 当前仅文字统计 + 三个等权灰色按钮，缺乏 Logo 和视觉重点。建议主操作（打开侧边栏）使用主色按钮。 |
| **统一模态框替代原生 confirm/alert** | UI Review | 中 | 中 | ⭐⭐⭐⭐ | Sidepanel 删除操作多处使用原生 `confirm()`/`alert()`，样式不统一且阻塞执行。建议复用自定义 Dialog。 |
| **图标系统统一化** | UI Review | 中 | 中 | ⭐⭐⭐ | 内联 SVG 与 UnoCSS Iconify（`i-carbon-*`）混用，增加维护负担。建议统一为单一方案。 |
| **Sidepanel 设置按钮固定定位** | UI Review | 低 | 低 | [已完成] | 当前设置按钮在 Header 内随页面滚动，长列表时难以访问。建议改为 `fixed`/`sticky`。 |
| **Tooltip 动态高度边界检测** | UI Review | 低 | 低 | ⭐⭐ | `tooltipHeight = 340` 为硬编码，标签过多时实际高度可能溢出，建议用 `getBoundingClientRect()` 动态计算。 |

## 4. 代码质量与规范类 (Low Hanging Fruits)

| 建议项目 | 来源 | 成本 | 收益 | 推荐等级 | 评估理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **导入顺序规范化 (Lint)** | PR #45 | 低 | 中 | ⭐⭐⭐ | 统一脚本的导入分组（外部库、内部模块、别名），提升代码扫描效率和可读性。 |
| **统一 `catch` 块格式** | PR #45 | 低 | 低 | ⭐⭐ | 全局清理 `catch {}` 为 `catch (error) {}`，保持代码风格一致性，符合现代 TS 实践。 |
| **ContentScripts 类型安全增强** | 分析 | 低 | 中 | ⭐⭐⭐ | `state.ts` 中 `previewApplier: any` 可收窄为 `rangy.ClassApplier \| null`；`restorer.ts` 中的 `as any` payload 可替换为强类型接口。 |
| **Monitor 生命周期管理完善** | 分析 | 低 | 低 | ⭐⭐ | `monitor.ts` 的 `destroy()` 方法已定义但从未被调用。在 `index.ts` 中接入 `beforeunload` 监听，确保 `history.pushState` monkey-patch 被正确还原。 |
| **注释语言国际化** | PR #45 | 低 | 低 | ⭐⭐ | 逐步将 Background 核心逻辑中的中文注释翻译为英文，提升项目的国际化潜力和长期维护性。 |
| **sync.ts 提取 GitHub API 统一包装** | 分析 | 低 | 中 | ⭐⭐⭐ | `getGists` / `createGist` / `updateGist` 中 401/403 错误处理完全重复，且无网络超时控制。提取 `requestGitHubAPI` 统一处理认证、超时和错误转换。 |
| **storage.ts Payload 类型收紧** | 分析 | 低 | 中 | ⭐⭐⭐ | `RemoveMarkPayload` / `UpdateMarkNotePayload` 等接口包含 `[key: string]: any`，抹平了类型检查。建议与消息协议类型对齐，移除 `any`。 |
| **dom.ts rangy 类型断言清理** | 分析 | 低 | 低 | ⭐⭐ | `Highlighter.applyPreciseHighlight` 中 `(rangy as any).createRange` 可替换为正确的 Rangy 类型定义，消除 `as any` 使用。 |

---

## 5. 暂不执行 (Wontfix/Later)

- **数据压缩 (Gzip)**: 会导致 Gist 网页端数据不可读，优先通过“数据精简”和“分片存储”解决容量问题。
- **GitHub API Rate Limit 监控**: 目前同步频率极低，监控成本大于收益。
- **自动聚类算法增强 (TF-IDF)**: 属于重量级特性。在用户量级上升前，手动标签系统已经足够。

---
**更新日期**: 2026-06-05
**维护者**: Gemini CLI & Driver
