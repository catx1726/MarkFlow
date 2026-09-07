# Task 003: restorer 旧数据 title 回填 + 单测 + 三层验证

## Context

存量数据(Revert 窗口期 / title 可选字段)可能整页缺 title,展示层修复无法覆盖;需页面重访时自愈。

## Current Logic

`src/contentScripts/restorer.ts` `restoreHighlights()` L75 拉取 `get-marks-for-url` 后直接进入恢复流程,不回补元数据。

## Target Logic

L75 fetch 成功后插入一次性回填调用:

```typescript
const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')
if (!marks || marks.length === 0) { ... }
this.backfillMissingTitles(canonicalUrl, marks)  // 新增
```

新增私有方法(每 URL 每会话一次;仅补 `!title && !deletedAt`;`document.title` 为空跳过;fire-and-forget):

```typescript
private titleBackfilledUrls = new Set<string>()

/** 旧数据自愈:缺 title 的标记在页面重访时补写当前网页标题(幂等,不覆盖已有标题) */
private backfillMissingTitles(url: string, marks: Mark[]): void {
  if (this.titleBackfilledUrls.has(url))
    return
  this.titleBackfilledUrls.add(url)
  const currentTitle = document.title
  if (!currentTitle)
    return
  for (const mark of marks) {
    if (!mark.title && !mark.deletedAt) {
      sendMessage('update-mark-details', { id: mark.id, url, title: currentTitle }, 'background').catch(() => {})
    }
  }
}
```

注意:jsdom 中 `document.title` 默认为空串 → 守卫使存量测试(`should mark restore as failed...` 的 mark 无 title)不受影响。

## Tests (RED → GREEN)

在 `src/tests/restorer.spec.ts` 新增:

1. `缺 title 的标记应在恢复时回填当前网页标题` —— 设 `document.title`,断言 `update-mark-details` 收到 `{ id, url, title }`;测后复原 `document.title`
2. `已有 title 的标记不回填` —— 断言无携带 title 的 `update-mark-details` 调用

## Verification(三层证据)

```bash
npx eslint src/logic/tagTree.ts src/contentScripts/restorer.ts src/sidepanel/components/TagFolder.vue src/sidepanel/components/PageSection.vue src/sidepanel/components/MarkItem.vue src/tests/tagTree.spec.ts src/tests/restorer.spec.ts  # 0 新增错误
npx vitest run --reporter=dot   # 新增用例通过;存量失败与基线一致(tagTree 4 + useUIState 1 + useSidepanelData 套件)
npm run build                   # exit 0
```

Layer 3(可选):`npm run dev` 人工验证:①多击三级标题行不再选中文字;②含真实标题的页面条目显示标题;③旧数据页面重访后侧边栏标题自愈。
