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
| **i18n 国际化基础框架** | PR #41 / 宣传分析 | 中 | 高 | ⭐⭐⭐⭐⭐ | 错误消息与全部 UI 文案均为硬编码中文。建立标准 i18n 体系是走向社区的基础；**英文界面是 Reddit 等海外社区宣传的前置门槛**（无英文 UI，海外宣传截图直接劝退）。 |
| **数据精简与字段剥离** | 讨论 | 高 | 高 | ⭐⭐⭐⭐ | 剥离冗余的上下文信息，比压缩算法更能提升系统健康度，且保持数据可读性。 |
| **统一消息返回格式** | PR #37 | 中 | 中 | ⭐⭐⭐⭐ | 统一 `{success, data, error}` 格式可简化前端错误处理模板。 |
| **search.ts `structureBoundaries` 单遍历构建** | 分析 | 中 | 高 | ⭐⭐⭐⭐ | `createSearchContext` 中对每个块级元素都调用 `getAllTextNodes(el)`，导致同一子树被反复扫描，形成 O(n²) 开销。改为一次遍历同时收集文本节点和结构边界。 |
| **`monitor.ts` MutationObserver 监听粒度过宽** | 分析 | 低 | 高 | [已完成] | 已在 `restorer.ts` 实现"恢复完成早退 + 5s 重验窗"：所有标记恢复完成后，monitor 触发的 `restoreHighlights` 在窗内直接跳过 `sendMessage` 往返与 Shadow DOM 查询；超窗后放行一次完整 pass 以捕获虚拟列表回收。无限滚动期间 restore 调用频率从 ~每 300ms 降至 ~每 5s。原建议（`monitor.ts:23-28` 以 `childList:true, subtree:true` 监听 `document.body` 任意 addedNodes 触发 300ms 防抖重恢复）不再造成性能隐患。 |
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
| **界面视觉精修 Sprint（可读性 / 层级减负 / 微交互）** | 设计走查 2026-08-20 | 中 | 高 | [PR 待验收] | 结构不需重设计（与 Readwise/Glasp 同构）。精修范围：①Tooltip 小字 10→12px（保 px，Shadow DOM 反 rem 污染）②侧边栏嵌套卡片改缩进+引导线 ③Tooltip/文件夹展开动画。**宣传素材质量的前置杠杆，应在英文 i18n 前完成**。 |
| **统一模态框替代原生 confirm/alert** | UI Review | 中 | 中 | ⭐⭐⭐⭐ | Sidepanel 删除操作多处使用原生 `confirm()`/`alert()`，样式不统一且阻塞执行。建议复用自定义 Dialog。 |
| **图标系统统一化** | UI Review | 中 | 中 | ⭐⭐⭐ | 内联 SVG 与 UnoCSS Iconify（`i-carbon-*`）混用，增加维护负担。建议统一为单一方案。 |
| **Sidepanel 设置按钮固定定位** | UI Review | 低 | 低 | [已完成] | 当前设置按钮在 Header 内随页面滚动，长列表时难以访问。建议改为 `fixed`/`sticky`。 |
| **Tooltip 选区感知定位 + 可拖拽** | 用户需求 2026-08-20 | 中 | 高 | [已实现待验收] | 当前 Tooltip 直接出现在鼠标松开位置（`clientX/clientY`），极易遮挡选中文字。改为以选区 Range 矩形为基准的智能定位（下方优先、上方翻转、不与选区重叠），并支持 header 拖拽。动态高度测量顺带解决下方 ⭐⭐ 条目。 |
| **Tooltip 动态高度边界检测** | UI Review | 低 | 低 | [并入上条] | `tooltipHeight = 340` 为硬编码，标签过多时实际高度可能溢出，建议用 `getBoundingClientRect()` 动态计算。 |
| **导出格式扩展（Obsidian/Notion/HTML）** | 分析 | 中 | 高 | ⭐⭐⭐⭐ | 当前 `useMarkActions.ts` 仅支持纯 Markdown 导出（含 Turndown 转换）。竞品（如 Highlight Sync）已提供 Obsidian frontmatter、Notion database、CSV、JSON、HTML 等多格式。MarkFlow 已记录 `contextTitle/contextLevel/tags` 等结构化元数据，扩展为 Obsidian `> [!quote]` callout + YAML frontmatter 或 Notion database properties 的成本较低，且能强化"结构化整理"这一卖点。 |
| **品牌色统一（扩展/宣传页 → amber 琥珀橙）** | 宣传分析 2026-08-20 | 低 | 高 | [已实现待验收] | 荧光笔隐喻色系（Driver 决策 2026-08-20）：扩展 UI、宣传页、扩展图标统一 amber；主按钮 amber-500+深字保证对比度；清理 teal 残留与硬编码 blue hex。 |
| **主题手动切换开关** | 宣传分析 2026-08-20 | 低 | 中 | ⭐⭐⭐ | 扩展界面仅跟随系统 `prefers-color-scheme`，无手动切换。宣传截图需要主动选择最美观的主题（如小红书浅色更亮眼），且宣传页已有 localStorage 切换可参照。 |
| **Tooltip 弹出/收起过渡动画** | 宣传分析 2026-08-20 | 低 | 中 | ⭐⭐⭐ | B 站视频演示中，划词工具栏的出现/消失流畅度直接影响观感。当前无过渡动画，补一个低成本 fade/scale 动画收益最高。 |
| **Popup 与宣传页 Logo 统一** | 宣传分析 2026-08-20 | 低 | 低 | ⭐⭐ | Popup 头部使用铅笔图标，宣传页使用 "M" 方块 Logo，品牌符号不一致。建议统一为宣传页的 "M" Logo（"Popup 视觉层次优化"条目的延伸）。 |
| **记忆上次使用的标签，下次标记默认预选** | 用户需求 | 低 | 高 | [已完成] | 已实现（Issue #54）：`settings.lastUsedTags`（本地偏好，不同步）；新建标记 `ui.showTooltip` 传 lastUsedTags 作为 initialTags；`Tooltip.show()` 内 `filterExistingTags` 过滤悬空 id；`createHighlight`（仅新建分支）保存后写入。原注意点已全部覆盖：①编辑已有标记用原 tags 不受影响；②标签删除后悬空 id 经 `filterExistingTags` 过滤；③"清除记忆"靠空选保存实现（YAGNI，不设独立按钮）。 |

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
| **sync.ts `mergeWithRemoteFile` 命名优化** | PR #51 | 低 | 低 | ⭐⭐ | 函数名暗示类方法，建议改为 `mergeRemoteFileContent` 或 `parseAndMergeRemoteFile` 以清晰表达纯函数语义。 |
| **background/main.ts 日志级别控制** | PR #51 | 低 | 低 | ⭐⭐ | `performPull` 中 `[Sync] Pull data` 等日志在每次拉取时输出，建议使用 `console.debug` 或添加日志级别控制，减少生产环境日志。 |
| **测试文件命名风格统一** | PR #51 | 低 | 低 | ⭐⭐ | `sync.spec.ts` 使用 `describe('sync Logic', ...)`，与 `restorer.spec.ts`/`ui.spec.ts` 的大小写风格不一致，建议统一。 |
| **theme-init.ts 添加 CSP 注释说明** | PR #51 | 低 | 低 | ⭐⭐ | 将内联脚本提取到外部模块是好的做法，建议在 `index.html` 中添加注释说明原因，帮助未来维护者理解。 |
| **Popup.vue sidePanel.open 类型守卫** | PR #51 | 低 | 低 | ⭐⭐⭐ | 当前使用 `(browser as any).sidePanel`，建议创建类型定义文件扩展 `browser` 类型，避免 `as any`。 |
| **search.ts 保留策略类注释** | PR #51 | 低 | 低 | ⭐⭐ | `ConsensusMatchStrategy` 等类已保留但不再使用，建议添加注释说明保留原因（如 SPEC-2026-06-26-001）。 |
| **`mergeWithRemoteFile` 在 `performPull` 中未使用** | PR #51 | 低 | 低 | ⭐⭐ | `sync.ts` 中设计和测试了 `mergeWithRemoteFile`，但 `performPull` 仍直接用 `mergeMarks`/`mergeTags`。建议统一使用辅助函数或移除死代码。 |
| **`withTimeout` 实现简化** | PR #51 | 低 | 低 | ⭐⭐ | 当前实现带 `clearTimeout`，CR 建议可简化为不带 `clearTimeout` 的 `Promise.race` 版本，避免微妙时序问题。 |
| **测试辅助函数共享化** | PR #53 | 低 | 低 | [已完成] | `buildSampleTree` 已提取到 `src/sidepanel/composables/__tests__/testUtils.ts`，`searchFilter.spec.ts` 与 `useSidepanelData.spec.ts` 复用。 |
| **CR 误判记录：`useSidepanelData.ts` 中 `debounceTimer` 实际已使用** | PR #53 | - | - | - | 多轮 CR 均认为 `debounceTimer` 未使用，但它在 `watch([marksByUrl, tagsMetadata])` 回调中用于防抖 `buildTagTree`。无需修改，仅作记录。 |

---

## 5. 暂不执行 (Wontfix/Later)

- **数据压缩 (Gzip)**: 会导致 Gist 网页端数据不可读，优先通过“数据精简”和“分片存储”解决容量问题。
- **GitHub API Rate Limit 监控**: 目前同步频率极低，监控成本大于收益。
- **自动聚类算法增强 (TF-IDF)**: 属于重量级特性。在用户量级上升前，手动标签系统已经足够。

---

## 6. 当前任务跟踪 (Active Work)

| 项目 | 来源 | 状态 | 关联 Issue/PR |
| :--- | :--- | :--- | :--- |
| **Chromium 商店上架** | 分析 | 待办 | - |
| **宣传页 OG/Twitter Card meta + 分享图（og-image 1200×630）** | 宣传分析 2026-08-20 | PR 待合并 | 已加全套 OG/Twitter 标签 + Playwright 渲染品牌分享图 |
| **宣传页英文版** | 宣传分析 2026-08-20 | 待办（P0） | Reddit 宣传前置；建议与扩展 UI 英文 i18n（§1）一起规划 |
| **宣传页 Tailwind CDN → 编译版迁移** | 宣传分析 2026-08-20 | 待办（P1） | 消除 production warning、可 purge、改善首屏；非阻塞 |
| **宣传素材准备（浅色模式截图 / 三连动图 / B 站演示 GIF）** | 宣传分析 2026-08-20 | 待办 | 依赖：品牌色统一 + 主题切换 |
| **品牌色统一（blue → amber 琥珀橙）** | 宣传分析 2026-08-20 | PR 待合并 | Issue #62, `docs/superpowers/specs/2026-08-20-brand-color-unification-design.md` |
| **Tooltip 定位与拖拽优化** | 用户需求 2026-08-20 | PR 待合并 | Issue #62, `docs/superpowers/specs/2026-08-20-tooltip-positioning-drag-design.md` |
| **界面视觉精修 Sprint** | 设计走查 2026-08-20 | PR 待验收合并 | Issue #65, `docs/superpowers/specs/2026-08-20-ui-polish-sprint-design.md` |
| 跳过 Level 3/4 恢复算法，侧边栏提示上下文 | `.temp/detail.md` | 已完成 | Issue #50, PR #51 |
| 高亮标记高度自定义 (`highlightHeight`) | `.temp/detail.md` | 已完成 | Issue #50, PR #51 |
| 侧边栏搜索功能（上下文保留 + 仅显示匹配项） | `.temp/detail.md` | 已完成 | Issue #52, PR #53 |

---
**更新日期**: 2026-08-20
**维护者**: OpenCode & Driver

---

## 附：代码审查核对记录 (2026-07-28)

本轮对工具进行全量代码阅读后，提出 12 条疑似问题，经逐一核对源码后的处置如下，作为后续审查的参考依据：

- **确认误判并移除（5 条）**：
  - `getGists` 死代码 → 实际被 `Options.vue:146` 同步连接流程调用
  - `cleanup-useless-marks` 高危 → `useStorageMonitor.ts:35` 已有 `confirm()` 二次确认
  - 侧边栏搜索未实现 → `useSidepanelData.ts:32` `filteredTree` + `searchFilter` 已落地
  - `shortcutSave/shortcutDelete` 未绑定 → `contentScripts/views/Tooltip.vue:127,132` 已消费
  - 测试偏单元 → 实测 25 个 spec 文件，覆盖 sync/search/restorer/tagTree 等核心算法

- **确认真实但已被现有条目跟踪（4 条）**：未重复添加
  - `ConsensusMatchStrategy` 死代码 → 见"search.ts 保留策略类注释"
  - `createSearchContext` 全量重建 → 见"structureBoundaries 单遍历构建"
  - `copyMarkText` 中文硬编码 → 见"i18n 国际化基础框架"

- **确认为新增并已入库（3 条）**：Chromium 上架、monitor 监听粒度、导出格式扩展

