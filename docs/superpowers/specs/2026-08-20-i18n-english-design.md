# Spec: 英文国际化（i18n）— 扩展 UI + 宣传页

**日期**: 2026-08-20
**状态**: 已批准（2026-08-20 Driver 确认；两项修订：① 增加设置页手动切换 ② 英文宣传页路径 `docs/lang/en/`）
**来源需求**: `docs/NIT_ROADMAP.md` §1 "i18n 国际化基础框架"（⭐⭐⭐⭐⭐，Reddit 宣传前置门槛）
**生命周期**: 标准生命周期（跨 20+ 文件的体系性变更）

---

## 1. 背景与问题

全部 UI 文案为硬编码中文。Reddit 等海外社区宣传时，中文界面截图与中文落地页会直接劝退非中文用户。

**文案盘点**（用户可见字符串，不含代码注释）：

| 区域 | 规模 | 文件 |
| :--- | :--- | :--- |
| sidepanel（含组件/composables） | ~63 行 | 12 个 |
| options | ~68 行 | 3 个 |
| contentScripts（Tooltip/Modal） | ~23 行 | 2 个 |
| popup | ~7 行 | 1 个 |
| background/logic 用户可见消息 | 少量 | sync 错误消息等 |
| manifest description | 1 条 | `extension/manifest.json` |
| 宣传页 `docs/index.html` | 整页 | 1 个 |

## 2. 目标 / 非目标

**目标**
- 建立 i18n 基础设施：TS 字典 + `t()` 函数 + 语言解析（自动检测 + 手动切换）
- 扩展全部用户可见文案英文化（zh 保持现状为源语言，en 为翻译目标）
- manifest name/description 双语（`_locales`）
- 设置页新增语言选项（跟随浏览器 / 中文 / English）
- 宣传页英文版（`docs/lang/en/index.html`，为后续多语言扩容预留目录结构）

**非目标（YAGNI）**
- ❌ 不翻译代码注释（Roadmap 另有 ⭐⭐ 条目）
- ❌ 不引入 vue-i18n 等第三方库——项目无组件库依赖，保持零依赖
- ❌ 不翻译错误日志内容（`errorCollector` 面向开发者）
- ❌ manifest 的 name/description 不提供手动切换（浏览器机制限制，跟随浏览器 UI 语言）

## 3. 方案选型

| 方案 | 优点 | 缺点 | 结论 |
| :--- | :--- | :--- | :--- |
| A. WebExtension 原生 `_locales` | 标准；商店上架素材本地化必需 | 扁平 key 无类型安全；Vue 模板需桥接 | **仅用于 manifest/商店** |
| B. TS 字典（扩展现有 `src/logic/i18n.ts`） | 类型安全（key 即类型）；Shadow DOM/任意上下文可用；零依赖 | 非标准 | **UI 文案主方案** |

**混合架构**：
```
src/logic/i18n/
  ├── index.ts        # t(path, params?) + 语言检测（getUILanguage）
  ├── locales/
  │   ├── zh-CN.ts    # 源语言（类型来源：export type Messages = typeof zhCN）
  │   └── en.ts       # 英文翻译（必须满足 Messages 类型，缺失 key 编译期报错）
extension/_locales/
  ├── zh_CN/messages.json   # 仅 name/description
  └── en/messages.json
```

- `t('tooltip.save')` 点路径取值；插值用 `{count}` 占位 + `params` 替换
- 现有 `i18n.ts` 的 `sync.helpContent`（大段 HTML）迁入字典结构，HTML 片段保留
- **缺失 key 策略**：类型系统强制 en 与 zh-CN 同构；运行时 fallback 到 zh-CN 文本

**语言解析（响应式）**：
```
settings.language: 'auto' | 'zh-CN' | 'en'（默认 'auto'，新增持久化字段）
解析：auto → browser.i18n.getUILanguage()（zh* → zh-CN，其余 → en）
t() 在渲染期读取响应式 locale → 设置页切换语言后全 UI 自动重渲染
（content script 的 Shadow DOM 视图同样读 settings，已有多端同步机制）
```

## 4. 实施分阶段（两个 PR）

**PR-1：基础设施 + 扩展 UI**
1. 新建 `src/logic/i18n/`（index + zh-CN + en）
2. 逐文件替换硬编码文案为 `t()`（sidepanel 12 → options 3 → tooltip/modal 2 → popup 1 → background/logic 消息）
3. `_locales` + manifest `default_locale: zh_CN`，name/description 改 `__MSG_*__`
4. 测试：t() 取值/插值/fallback/语言检测映射 单测

**PR-2：宣传页英文版**
- `docs/lang/en/index.html`（英文翻译版），`docs/index.html` 顶部加语言切换链接；og:locale 等 meta 适配

## 5. 风险与验证

**风险**
- 英文比中文长 ~30%：按钮（"确认高亮"→"Save Highlight"）、标签 chip、侧边栏行可能溢出 → Layer 3 验收重点
- `v-html` 渲染的 helpContent 翻译时保留 HTML 结构与 class
- `confirm()`/`alert()`（7 处）文案替换注意插值

**验证（三层证据）**
- Layer 1：lint-staged + typecheck（en 字典缺 key 直接编译报错）
- Layer 2：新增 i18n 单测全绿；存量测试无新增失败；build ×3 exit 0
- Layer 3：浏览器语言切英文后逐界面截图验收（popup/sidepanel/options/tooltip/modal），检查溢出与换行

## 6. 回滚

`git revert` 对应 PR（纯文案层，无数据迁移）
