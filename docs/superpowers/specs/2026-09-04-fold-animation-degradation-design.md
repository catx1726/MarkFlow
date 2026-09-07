# 大列表展开动画自适应降级 — 极简设计文档

> Issue: [#80](https://github.com/catx1726/MarkFlow/issues/80) ｜ 类型： refactor ｜ 工作流： Surgical（≤5 文件、无接口变更）

## 问题

展开动画使用 `grid-template-rows: 0fr↔1fr`，每帧触发整棵子树重排。20+ 条 MarkItem 时单帧布局成本超 16ms 帧预算——物理瓶颈，`contain: layout paint` 无法减少子树自身布局量。

## 方案（对齐 issue 推荐的自适应降级）

**新增 `src/sidepanel/composables/foldAnimation.ts`**（集中常量 + 纯函数，可单测）：

```ts
FOLD = {
  largeListThreshold: 20,   // >20 条标记 → 降级（count × 32px 预估 ≈ 640px）
  estimatedMarkHeight: 32,
  heightDuration: 150,      // 小列表高度动画（现状）
  fadeDuration: 100,        // 大列表纯淡入
  defaultCollapseMarkThreshold: 15,  // 收编散落的魔法数字 15
}
export function shouldUseFadeOnly(markCount: number): boolean
```

**改动**：

| 文件 | 行 | 改动 |
|---|---|---|
| `foldAnimation.ts`（新建） | — | 常量 + `shouldUseFadeOnly` 纯函数 |
| `PageSection.vue` | 202-208 / 278-284 | Transition 类按 `urlData.totalMarks` / `group.count` 动态切换：低于阈值用现有 `fold-*`，超过用新增 `fold-fade-*`（仅 opacity 100ms，无 grid 行高过渡；动画期仍保留 `overflow:hidden` 裁剪——见风险 1） |
| `PageSection.vue` | 97-102 / 315-346 | 收编魔法数字 15；新增 `fold-fade-*` CSS |
| `TagFolder.vue` | 93-122 / 297-315 | 按 `folder.totalMarks` 切换计时与动画：fade-only 模式用 100ms 且跳过双层 rAF 等待；150/160ms 三处硬编码改为读常量 |
| `Sidepanel.vue` | 142-151 | `totalMarks > 15` 改读集中常量 |
| `src/tests/foldAnimation.spec.ts`（新建） | — | `shouldUseFadeOnly` 阈值边界单测（19/20/21） |

**非目标**：`prefers-reduced-motion` 支持（全仓库现状为零，另行立项）。

## 风险与缓解（对齐 issue）

1. **裁剪窗口约束**：`overflow:hidden` 常驻会裁剪 ⋯ 菜单（现有注释明确警告）→ fade-only 模式保留动画期裁剪、结束即移除，与现状一致
2. **大小列表体验割裂**：降级动画同向（淡入+轻微下滑），100ms 与 150ms 接近
3. **嵌套动画叠加**：三级（folder/url/group）分别按各自容器内实际 mark 数判定降级

## 验证

- 红→绿：先写 `foldAnimation.spec.ts` 失败测试再实现
- `npx vitest run` 全绿 + lint / build exit 0
- **Layer 3**：构建扩展，20/30/50 条三档分组展开目测帧率流畅；小列表（<20）动画零回归

## 质量指标（对齐 issue）

- [ ] 展开 30+ 标记分组无肉眼可见卡顿
- [ ] 阈值/策略集中定义，不散落组件
- [ ] 小列表体验零回归

---

## 修正案（2026-09-04，Driver 反馈降级后仍卡顿）

fade 降级只去掉了「每帧重排」，未解决**展开瞬间一次性挂载数百 DOM 节点的长任务**。
技术路线排除：JS 逐帧改高度（每帧同样触发子树布局，无效）；`content-visibility: auto`
（强制 paint containment，会裁剪 ⋯ 下拉菜单，不可用）。

**追加实现 v1：分批挂载（已撤销）**——展开大分组时每帧追加 10 条 mark。
Driver 反馈：卡顿消除但产生「分块出现/消失」的割裂观感，方案撤销。

**最终实现 v2：FoldPanel（JS 测量高度动画）**——新建
`src/sidepanel/components/FoldPanel.vue`：内容一次性完整挂载（子树只布局
一次），动画作用于外层容器的固定 px 高度（overflow hidden 裁剪）——
每帧仅容器自身与后续兄弟元素重排，子树不参与，过渡丝滑无分块。
PageSection 两级折叠与 TagFolder（保留 details 手风琴语义，onSummaryClick
改为同一 JS 测量方案）统一使用；grid 0fr↔1fr 相关 CSS 全部移除。
超过阈值（>20）时缩短动画时长至 100ms（同向降级）。动画期裁剪、结束即
还原 auto 高度与可见溢出，不遮挡 ⋯ 菜单；enter/leave cancelled 有清理。

### 修正 v2.1（Driver 反馈：大列表 100ms 等于瞬切）

measured-px 高度动画对子树零成本，大列表无需缩短时长——相反，容器越高
距离越长，100ms 扫过 2000px 视觉上就是「直接隐藏」。改为大列表使用更长
时长（`FOLD.largeListDuration: 200`），`shouldUseFadeOnly` 更名 `isLargeList`，
移除 `fadeDuration`。另修复动画期间内部 sticky 吸顶头跟随缩小容器重新吸附
导致的标题跳动/位置错乱：动画期容器加 `fold-animating` 类，内部 `.fold-sticky`
临时降为 static（FoldPanel 全局样式 + TagFolder 同步）。

运行时证据（mock 浏览器环境逐帧采样容器高度，30 条标记文件夹）：
收起 135→129→122→104→92→66→51→18→0（9 档中间值，连续滑动）；展开同理。
