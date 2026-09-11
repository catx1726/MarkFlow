---
handoff_id: coach-tip-closeout-2026-09-11
author: OpenCode (opencode, GLM)
created: 2026-09-11
status: active
session_scope:
  - Coach Tip（页面内首次引导浮层）全生命周期：brainstorm → spec → plan → subagent 执行 → 验收调试
  - Tooltip 快捷键一次性提示（验收中派生的新特性）
  - GitHub repo SEO（topics + description）
next_task:
  - 本地 JSON 备份/导入（feat/local-backup，新 session，从 main 切出）
dependencies:
  - docs/superpowers/specs/2026-09-11-coach-tip-design.md
  - docs/superpowers/specs/2026-09-11-tooltip-shortcut-hint-design.md
  - docs/superpowers/plans/2026-09-11-coach-tip.md
  - docs/NIT_ROADMAP.md（§6 Active Work / §7 推广与 SEO）
---

# Coach Tip 收口 & Onboarding 外壳后续交接

## 1. 当前仓库状态（新 session 必读）

- **分支 `feat/coach-tip`：18 commits，功能已全部验收，尚未合并**。收尾方式由 Driver 定
  （本地合 main / 推 PR 均可；**下一个特性（本地备份）的分支必须从合并后的 main 切出**，勿叠加在未合并的栈上）
- 本 session 最后动作：GitHub 仓库元数据 SEO 已应用（description 降调版 + topics 19 个），roadmap §7 该行已转正 [已完成]
- 工作区干净，HEAD = 6093ce8

## 2. 本 session 交付清单

| 交付 | 位置 | 状态 |
|------|------|------|
| Coach Tip 浮层（普通划词一次性教 Alt 手势） | src/logic/coachTip.ts + contentScripts/views/CoachTip.vue + index.ts/ui.ts | 已验收（含 3 轮 CR 修复） |
| Tooltip 快捷键一次性提示（首次打开教 Alt+S/D） | Tooltip.vue + tooltipShortcutHint.spec.ts | 已验收（深色对比度 + disabled 方向两次修复） |
| Options「重新显示」 | Options.vue + isReshowDisabled | 已验收（e2e 闭环：已显示→可点→重置两标志→未显示+禁用） |
| i18n 双语词条 + settings 两标志 | locales/{zh-CN,en}.ts + settings.ts | coachTipDone / tooltipShortcutHintDone（均本地偏好不同步） |
| 文档 | specs ×2 / plan ×1 / NIT_ROADMAP §3 §6 §7 / ops_changelog 多行 | 全部提交 |

## 3. 下一个任务：本地 JSON 备份/导入（roadmap §3 P0）

- **Driver 已确认放弃「删除撤销」**（理由：标记可回网页重做；但注意**侧边栏备注/标签/组织结构是不可再生数据**，这正是备份的价值）
- 方案已在 roadmap：Options 增加全量导出（marks+tags+settings 带版本号）与导入（格式校验 + 复用 `sync.ts` 的 merge 合并策略）
- 建议流程：新 session → brainstorm（新 spec）→ plan → 执行；分支 `feat/local-backup` 从 main 切出
- 之后再排：落地页技术 SEO（P0，docs/ 静态无代码冲突）→ 恢复失败标记可见性（P1，上架后）
- **提醒 Driver：Chromium 商店上架是关键路径时钟（审核按天计），材料就绪先提交**

## 4. 环境陷阱备忘（本 session 实测踩坑，新 session 勿重复）

1. **`webext-settings` 在 storage.local 中是 JSON 字符串**（useWebExtensionStorage 的 object 序列化器）。e2e 种子直接 set 对象会导致 Options 端 JSON.parse 抛错静默回退默认值——症状是「UI 全是默认值但 storage 读出来是对的」
   > **2026-09-11 备份 session 勘误**：实测 `marks-by-url-storage` 与 `webmarker-tags-metadata` **同样是 JSON 字符串**——所有 useWebExtensionStorage 的 object 值都走该序列化器，e2e 断言这三个 key 一律要 `JSON.parse`
2. **e2e dev 模式 content script 注入已坏**（playwright webServer 起 `npm run dev` 后内容脚本不加载，console 无任何日志；疑似 vite dev/HMR 管线问题，pre-existing）。扩展 e2e 请走生产构建 + `chromium.launchPersistentContext(--load-extension)`，参考本 session 的 .temp/tmp-*.mjs 模式（已删，本 handoff §5 有要点）
3. **基线债务（main 上既有，非本分支引入）**：全量 vitest 5 failed + 1 suite error（tagTree×4/useUIState×1/useSidepanelData）；typecheck ~30 错误；lint 1386 错误（83 个 .md/.yml）；pnpm-lock.yaml 落后 package.json（缺 ts-ebml/webm-muxer）。验收标准一律用「触碰文件零新增」
4. **子代理/reviewer 禁止在主仓库 checkout 其他 commit 做验证**——会砸掉 node_modules junction（.bin 丢失）；修复方式 `corepack pnpm install --force`，但会重生成 lockfile（记得 `git checkout HEAD -- pnpm-lock.yaml`）
5. **Coach Tip 测试协议**：普通划词（不按 Alt）→ 出浮层；按 Alt 划词 → 出高亮 Tooltip 且**有意抑制**浮层（已会手势）。Options「重新显示」重置两个标志
6. **文案降调红线**（#85 + 本 session GitHub 元数据沿用）：禁「智能/精准/瞬间/100%」类词；「数据仅存本地」是已核实表述（有可选 Gist 同步）

## 5. 扩展 e2e 复现要点（生产构建）

```js
// chromium.launchPersistentContext(临时目录, { args: ['--disable-extensions-except=<repo>/extension', '--load-extension=<repo>/extension'] })
// → newPage().goto('https://example.com') → waitForSelector('#web-marker-extension', { state: 'attached' })
// 划词：mouse.move/down/move(steps:8)/up → waitForTimeout(500)
// 读标志：context.serviceWorkers()[0].evaluate(() => chrome.storage.local.get('webext-settings'))  // 注意 JSON.parse
// Shadow DOM 可穿透：page.locator('.coach-tip') 直接命中（open shadow root）
```

> **2026-09-11 备份 session 勘误（e2e 三则）**：① Options 页路径是 `chrome-extension://<id>/dist/options/index.html`（有 `dist/` 前缀）；② `launchPersistentContext` 需 `headless: false`——headless shell 不支持 `chrome://`/`chrome-extension://` 页面（ERR_INVALID_URL）；③ 确认弹窗按钮文案是「确认」非「确定」（`common.confirm`）。

## 6. 验证证据存档

- Coach Tip 生产构建矩阵：全新 profile ✓ / 旧设置升级路径 ✓ / 双击选词 ✓（Chromium，用户 zip 同源构建）
- 快捷键提示深色对比度：kbd gray-500→gray-200 on neutral-600，≈2:1→≈6:1（计算样式实测）
- 重新显示 e2e 闭环：已显示可点 → 点击两标志归零 → 未显示+禁用 ✓
