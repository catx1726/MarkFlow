# Task 002: tagTree pageTitle 取首个有 title 的标记 + 单测

## Context

`src/logic/tagTree.ts:47` — `marks[0]?.title || new URL(url).hostname`:存储序首个标记缺 title 时错误降级为 hostname。

## Current Logic

```typescript
const pageTitle = marks[0]?.title || new URL(url).hostname
```

## Target Logic

```typescript
const pageTitle = marks.find(m => m.title)?.title || new URL(url).hostname
```

## Tests (RED → GREEN)

在 `src/tests/tagTree.spec.ts` 新增两个单概念用例(使用合法 URL,避开存量失败用例的假 URL 问题):

1. `pageTitle 应取同页首个有 title 的标记` —— marks[0] 无 title、marks[1] 有 title → pageTitle 为 marks[1].title
2. `整页标记均无 title 时应降级为 hostname` —— pageTitle 为 'example.com'

## Verification

```bash
npx vitest run tests/tagTree.spec.ts --reporter=dot
# 期望:新增 2 用例通过;存量 4 个失败保持不变(假 URL 'url-1' 触发,与本改动无关)
```
