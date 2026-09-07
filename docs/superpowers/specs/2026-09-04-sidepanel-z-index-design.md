# 侧边栏 z-index 层级修复 — 极简设计文档

> Issue: [#79](https://github.com/catx1726/MarkFlow/issues/79) ｜ 类型： bug ｜ 工作流： Surgical（≤7 文件、无接口变更）

## 问题

吸顶体系（sticky z-10~40）与浮层体系（菜单 z-20/30、存储栏 z-10）共用数值区间，导致：

1. **菜单被吸顶元素遮挡（根因）**：三个 ⋯ 菜单（`PageSection.vue:149/235`、`TagFolder.vue:170`）是 sticky 元素的**子节点**，自身 z 再高也被父级吸顶头的堆叠上下文封死——根上下文中，z-20 的 URL 菜单只是"z-20 整体"，必输给 z-30 文件夹行与 z-40 主 header。
2. **StorageManager（fixed z-10）被全部吸顶层（z-20~40）覆盖**。
3. MarkItem 菜单 z-30 与文件夹行 z-30 同值，靠 DOM 序定胜负。

## 方案（推荐 A）

### A. z token 化 + 「菜单打开时提升所在吸顶层」（最小侵入）

**新增 `src/logic/layers.ts`**（sidepanel 作用域，注释注明与 content-script 的 `getMaxZIndex` 体系隔离）：

```
content: 0 / stickyChapter: 10 / stickyPage: 20 / stickyFolder: 30 / stickyHeader: 40
fixedBar: 50 / menuElevated: 60 / modal: 70
```

**改动**：

| 文件 | 行 | 改动 |
|---|---|---|
| `layers.ts`（新建） | — | 导出 `Z_LAYERS` 常量 |
| `SidepanelHeader.vue` | 30 | `z-40` → `z-[40]` token 注释（或 `style` 绑定） |
| `TagFolder.vue` | 134 | z-30 → token；`activeFolderMenu === folder` 时升为 60 |
| `TagFolder.vue` | 170 | 菜单 z-20 → 删除（父级已提升，无需自身 z） |
| `PageSection.vue` | 113 | z-20 → token；`activeUrlMenu === url` 时升为 60 |
| `PageSection.vue` | 149 | 菜单 z-20 → 删除 |
| `PageSection.vue` | 212 | z-10 → token；`activeGroupMenu === group.title` 时升为 60 |
| `PageSection.vue` | 235 | 菜单 z-20 → 删除 |
| `MarkItem.vue` | 175 | 菜单 z-30 → 60（位于根上下文，直接提升即可） |
| `StorageManager.vue` | 37 | z-10 → 50（压过全部吸顶层 40） |
| `Sidepanel.vue` | 319/365 | 模态 z-50 → 70 |
| `PageSection.vue` | 109-111 | 同步层级注释 |
| `TagFolder.vue` | 132 | 同步层级注释 |

原理：菜单打开时，其所在的 sticky 祖先临时升至 60（高于所有吸顶层 40 与底栏 50），菜单随父级脱离遮挡。菜单同一时刻只开一个（`closeMenus` 已保证），无并发冲突。

### B.（备选，不做）菜单 Teleport 到 body + fixed 定位

根治但需为 4 处菜单重写定位逻辑（从 `absolute right-0` 改为按 trigger rect 计算 fixed 坐标），改动面翻倍，收益相对 A 无用户可感知差异。

## 验证

- 特征测试：`src/tests/` 无相关组件测试，纯 class/常量变更，跑既有测试防退化（`npx vitest run`）
- lint / build exit 0
- **Layer 3 运行时验证**（UI 行为变更，必须）：构建扩展加载，按 issue 复现步骤截图：① 吸顶标签夹下方打开 ⋯ 菜单完整显示 ② 滚动到底部存储栏不被遮挡

## 验收标准（对齐 issue）

- [ ] 标签夹吸顶时，其下方任意层级打开的 ⋯ 菜单完整显示在其上方
- [ ] 滚动到页面底部，存储栏不被任何吸顶元素遮挡
