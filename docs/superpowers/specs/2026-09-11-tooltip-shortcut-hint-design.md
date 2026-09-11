# Tooltip 快捷键一次性提示（Shortcut Hint）设计

- **日期**: 2026-09-11
- **来源**: Coach Tip 验收讨论（Driver 2026-09-11）——自己发现 Alt 手势的用户首次打开 Tooltip 时，无任何快捷键提示（Alt+S 保存 / Alt+D 删除只存在于 Options 欢迎页）
- **状态**: 已批准（Driver 2026-09-11，内联实现）
- **关联**: `2026-09-11-coach-tip-design.md`（同属 onboarding 外壳层，同分支）

## 设计

- **settings**：`tooltipShortcutHintDone: false`（本地偏好，不同步）
- **触发**：`Tooltip.vue` `show()` —— flag 未置位 → 渲染提示行 + **显示即置位**（同 Coach Tip 哲学：保证严格一次；storage 写失败最坏多显示一次，无害）
- **UI**：`.tooltip-actions` 上方一行提示：`[Alt+S] 保存 · [Alt+D] 删除`——
  - 键帽沿 Options 欢迎页 neutral 先例（`bg-neutral-200 dark:bg-neutral-600 rounded border font-mono`），非 Coach Tip 的 amber（此处是辅助信息不是主角）
  - **kbd 必须带显式文字色**（`text-gray-600 dark:text-gray-200`）：键帽无自身文字色时会继承行的 muted 色，落在键帽底色上近不可读（深色 gray-500 on neutral-600 ≈2:1——2026-09-11 验收实测修复）；行文字用 `text-gray-400`（Tooltip muted 惯例，勿用 gray-500）
  - 键位**动态读 `settings.shortcutSave` / `shortcutDelete`**，用户自定义后自动跟随
  - 文字 `text-[11px]`，px 任意值（Shadow DOM 约定）
- **Options「重新显示」**（2026-09-11 验收修订）：重置**两个**一次性标志（`coachTipDone` + `tooltipShortcutHintDone`）；状态行与 disabled 判定改为「两者均已显示」
- **i18n**：零新增 key——复用 `common.save` / `common.delete`
- **测试**（TDD）：组件测试挂载 Tooltip——flag false → 提示行存在、键帽文本=当前设置值、flag 置位；flag true → 提示行不存在

## 变更文件

| 文件 | 变更 |
| :--- | :--- |
| `src/logic/settings.ts` | +1 字段 |
| `src/contentScripts/views/Tooltip.vue` | show() 置位 + 模板提示行（~15 行） |
| `src/tests/tooltipShortcutHint.spec.ts` | 新增组件测试 |
