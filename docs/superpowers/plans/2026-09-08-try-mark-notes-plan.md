# 体验页与落地页补充「标记备注」实施计划

**Goal:** 补回 PR #84 遗漏的标记备注能力——体验页备注闭环（创建写备注/管理改备注/侧栏只读展示/刷新恢复）+ 落地页文案（zh+en 步骤 1 与图注）。

**Architecture:** 纯增量：try.js 加 note 字段与两处气泡输入、侧栏展示一行；4 页 HTML 弹窗加条目；落地页两处文案。无新文件、无依赖。

**Tech Stack:** vanilla JS / Tailwind CDN / Playwright（playwright-core + 系统 Chrome）

**关联:** Spec `docs/superpowers/specs/2026-09-08-try-mark-notes-design.md`；Issue #85

---

## Tasks

| # | Task | 内容 | 验证 |
| :-: | :--- | :--- | :--- |
| 001 | 引擎与页面 | try.js note 字段 + 创建/管理气泡 textarea + Alt+S 带备注 + 侧栏只读行；4 页弹窗加「备注」条目 | 新增备注回归（创建带备注/空备注不渲染/管理改写/Alt+S/刷新）全绿 |
| 002 | 落地页文案 + 收尾 | zh+en 步骤 1 与图注；复跑既有套件 + eslint；留档 | 文案断言通过；21+10+10 全绿 |
| 003 | tooltip 布局对齐 | Driver 走查反馈：textarea 无法聚焦（mousedown preventDefault 一刀切）→ 放行输入控件；tooltip 布局偏离扩展 → 对齐 Tooltip.vue 卡片式（w320/shadow-xl/色板选中态/按钮行/复制按钮）；`color-dot` CSS 废弃；Alt+S 语义对齐扩展 | 9 项真实鼠标路径测试全绿 + 全量回归无退化 |

> 单点改动、范围小，两 task 一次提交流程走完（PR 关联 Closes #85）。
