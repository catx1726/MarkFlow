# Coach Tip（页面内首次引导浮层）设计

- **日期**: 2026-09-11
- **来源**: `docs/NIT_ROADMAP.md` §3「页面内首次引导浮层（Coach Tip）」（产品实测分析 2026-09-10，⭐⭐⭐⭐⭐，Chrome 上架前转化率最高的准备）
- **状态**: 已批准（Driver 2026-09-11）

## 1. 问题与目标

`Alt`+划词是 MarkFlow 的核心手势，但**零发现机制**——新用户安装后不知道它的存在，首次划词无任何反馈。目标：首次**未按 Alt** 划词时，在选区旁出现一次性轻提示「按住 Alt 划词即可标记」，把核心手势教给用户。

**成功标准**：
1. 全新用户第一次普通划词即看到提示，且此后永不重复（严格一次）
2. 用户若先通过 Alt 成功创建了标记，则视为已学会，永不显示
3. 提示不打断页面交互（点击穿透、无事件劫持）
4. Options 提供「重新显示」入口（宣传片/商店截图可重现）
5. 中英双语，暗黑模式自动跟随

## 2. 决策记录

| 决策点 | 结论 | 备选与理由 |
| :--- | :--- | :--- |
| 「一次性」语义 | `settings.coachTipDone` 标志位；**显示即置位** + **Alt 成功标记即置位**（学会即标记） | 备选「查询全局标记数仅新用户可见」被否：多一次后台查询与分支，收益低 |
| 设置项形态 | Options 加「重新显示」按钮（点击置 `coachTipDone = false`） | 备选「仅存储无 UI」被否：无法低成本重现引导场景 |
| 实现架构 | 独立轻量 Vue 视图 `CoachTip.vue`，Shadow DOM 内第三 app | 备选「原生 DOM 注入」背离项目视图模式；「Tooltip 加 coach 模式」违反 SRP（Tooltip 已 468 行） |
| 浮层交互性 | `pointer-events: none` 纯提示 | 无按钮可点，点击穿透页面，消失逻辑最简 |

## 3. 架构设计

### 3.1 触发链路

```
handleMouseUp (index.ts)
  └─ processSelection
       ├─ isNewSelectionAction (Alt+划词) → Tooltip（既有路径，不变）
       ├─ markElement 点击 → 既有路径（不变）
       └─ 末尾分支（本次改动点）：
            if shouldShowCoachTip({ altKey, isCollapsed, onMarkElement, coachTipDone })
              → ui.showCoachTip(selectionRect)
              → settings.coachTipDone = true   // 显示即置位，保证严格一次
```

- 触发条件（纯函数 `src/logic/coachTip.ts`）：

  ```ts
  shouldShowCoachTip({ altKey, isCollapsed, onMarkElement, coachTipDone }): boolean
  // true 当且仅当：!altKey && !isCollapsed && !onMarkElement && !coachTipDone
  ```

- 锚点矩形：`getRangyRangeRect(selection.getRangeAt(0))`，取不到回退 `DOMRect(event.clientX, event.clientY, 0, 0)`（同 Tooltip 惯例）
- 学会即标记：`UIManager.createHighlight` 成功（`add-mark` 发送后）置 `coachTipDone = true`

### 3.2 组件与挂载

- **`src/contentScripts/views/CoachTip.vue`**（新，~80 行）：
  - 内容：键帽样式 `<kbd>Alt</kbd>`（Mac 渲染 `⌥ Option`）+ 提示文案
  - 风格遵循 Shadow DOM 视图约定（`docs/superpowers/specs/2026-08-20-ui-polish-sprint-design.md` §1）：**px 任意值**（`text-[12px]`、`px-[12px]`），禁 rem；`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl`；amber 键帽（`bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded border`）
  - 动画：复用 `tooltip-pop-in` 模式（150ms ease-out，keyframes 在 scoped style 内定义，绑定 `isPositioned`）
  - 定位：两阶段渲染——先 `visibility: hidden` 挂载测量 `getBoundingClientRect()`，再 `computeTooltipPosition(anchorRect, size, viewport)`（选区下方优先、上方翻转、clamp），最后显示
  - `pointer-events: none`；`defineExpose({ show, hide })`
- **`UIManager`**（ui.ts）：
  - `ensureMounted` 中新建 `coachTipRoot` div，`createApp(CoachTip)` 挂载（与 Tooltip/Modal 同一 `uiRoot`，自动继承 dark class watchEffect）
  - **私有持有 app 引用**（不放 `HighlightStateManager`——仅 index/ui 两处使用，最小暴露原则）
  - 新增公开方法：
    - `showCoachTip(anchorRect: DOMRect): void` —— 置顶 z-index（`getMaxZIndex() + 100`）、启动 6s 超时
    - `hideCoachTip(): void` —— 隐藏 + 清除超时
- **`src/contentScripts/index.ts`**：
  - `processSelection` 末尾分支接入触发（~5 行）
  - `handleMouseDown` 首行加 `ui.hideCoachTip()`（任何新点击立即消失）
  - `showCoachTip` 时注册 `window.addEventListener('scroll', hide, true)` capture 一次型监听（页面滚动即隐藏，防脱锚；隐藏时移除）

### 3.3 消失机制（三个通道，任一触发）

| 通道 | 时机 | 实现 |
| :--- | :--- | :--- |
| 超时 | 6s 自动消失 | `UIManager` 私有 timer |
| 点击 | 任何新 `mousedown` | `handleMouseDown` 首行 |
| 滚动 | 页面任意滚动（capture） | 一次型 scroll 监听 |

### 3.4 设置与存储

- `src/logic/settings.ts`：`defaultSettings` 新增 `coachTipDone: false`（注释标注「本地偏好，不同步」，同 `lastUsedTags` 惯例）
- `useWebExtensionStorage('webext-settings', ...)` 读取时新字段为 `undefined`（falsy）→ 老用户升级后等同未置位，会看到一次提示（§2 决策已接受）；首次显示后 settings 全量回写，字段随之补齐，无迁移成本

### 3.5 Options UI

- 一般设置区新增一行「首次使用引导」：
  - 状态文案：已显示 / 未显示（读 `settings.coachTipDone`；**2026-09-11 验收修订**：与 `tooltipShortcutHintDone` 联动，两者均已显示才为「已显示」）
  - 「重新显示」按钮 → **同时重置** `coachTipDone` 与 `tooltipShortcutHintDone`（两个一次性引导统一重置，见 `2026-09-11-tooltip-shortcut-hint-design.md`）
- i18n 词条：`options.coachTipSectionLabel` / `options.coachTipStatusShown` / `options.coachTipStatusNotShown` / `options.coachTipReshow`

### 3.6 i18n（双语同构，编译期校验）

| key | zh-CN | en |
| :--- | :--- | :--- |
| `coachTip.hint` | `按住 {key} 划词即可标记` | `Hold {key} while selecting to highlight` |

- 键帽文案由纯函数 `coachKeyLabel(isMac): string` 提供：Mac → `⌥ Option`，其他 → `Alt`
- 插值复用 `t()` 既有 `{key}` 参数机制

## 4. 数据流

```
用户划词(无Alt) → mouseup → processSelection
  → shouldShowCoachTip(...) === true
  → ui.showCoachTip(rect) ──→ CoachTip.vue.show(rect) ──→ 测量/定位/显示
  → settings.coachTipDone = true （写 storage，本地不同步）
                                        ↓
用户 6s内点击/滚动 或 6s超时 → hideCoachTip()（不影响标志位）
────────────────────────────────────────────
用户 Alt+划词保存成功 → createHighlight → settings.coachTipDone = true
Options「重新显示」→ coachTipDone = false → 下次普通划词再触发一次
```

## 5. 错误处理与边界

| 场景 | 行为 |
| :--- | :--- |
| 黑名单页面 | content script 不初始化，天然不触发 |
| INPUT/TEXTAREA/contentEditable 划词 | `handleMouseUp` 既有过滤，不触发 |
| 双击/三击选词（无 Alt） | 合法触发场景（正是教学时机） |
| 点击已有标记 | `markElement` 分支先返回，不触发 |
| storage 写失败 | 最坏「下次多显示一次」，无害，不额外重试 |
| SPA 路由切换 | 路由切换必先经 mousedown（点击链接/按钮）→ 立即隐藏；即使键盘导航切换也有 6s 超时兜底，无跨页残留 |

## 6. 测试策略（TDD，先红后绿）

- **纯逻辑单测** `src/tests/coachTip.spec.ts`（vitest，项目既有 25 个 spec 同构）：
  - `shouldShowCoachTip`：普通划词未置位 → `true`；已置位 → `false`；折叠选区 → `false`；点击已有标记 → `false`；按了 Alt → `false`
  - `coachKeyLabel`：Mac → `⌥ Option`；非 Mac → `Alt`
  - i18n 插值：`t('coachTip.hint', { key })` 中英双语句式完整（回归 `i18n.spec.ts` 既有同构校验）
- **组件行为**：CoachTip.vue 两阶段定位（`isPositioned` 前不可见）不在 jsdom 深测布局（项目先例：布局类逻辑下沉 `tooltipPosition.ts` 纯函数已覆盖），组件仅断言 `show/hide` 状态翻转
- **回归**：`npm run test` 全量通过；`npm run lint` + typecheck 0 error

## 7. 变更文件清单

| 文件 | 变更 |
| :--- | :--- |
| `src/logic/coachTip.ts` | 新增：`shouldShowCoachTip` / `coachKeyLabel` 纯函数 |
| `src/contentScripts/views/CoachTip.vue` | 新增：提示条组件 |
| `src/tests/coachTip.spec.ts` | 新增：单测 |
| `src/logic/settings.ts` | +1 字段 `coachTipDone` |
| `src/contentScripts/ui.ts` | 挂载 + `showCoachTip`/`hideCoachTip` + `createHighlight` 置位 |
| `src/contentScripts/index.ts` | 末尾分支触发 + mousedown/scroll 隐藏 |
| `src/logic/i18n/locales/zh-CN.ts` / `en.ts` | `coachTip.hint` + `options.*` 词条 |
| `src/options/Options.vue` | 「首次使用引导」状态行 + 重新显示按钮 |

## 8. 不做的事（YAGNI）

- 不做多步引导（tour/spotlight 序列）——只教 Alt 手势这一个动作
- 不做「仅全新用户」的全局标记数查询
- 不做引导浮层上的可点击按钮（如「知道了」）——点击穿透 + 超时消失已足够
- 不做显示时长/位置的设置项
