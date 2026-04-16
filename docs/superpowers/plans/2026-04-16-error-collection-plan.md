# 错误捕获、收集与导出功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个轻量级的错误捕获与收集机制，并允许用户手动导出日志以辅助排查问题。

**Architecture:** 创建 `ErrorCollector` 模块，利用 `chrome.storage.local` 存储日志，并挂载全局事件监听器。在 Options 页面提供导出 UI。

**Tech Stack:** TypeScript, Chrome Extension API (storage).

---

### Task 1: 核心逻辑 `ErrorCollector` 模块

**Files:**
- Create: `src/logic/errorCollector.ts`

- [ ] **Step 1: 定义数据结构与常量**

```typescript
// src/logic/errorCollector.ts
export interface ErrorLog {
  timestamp: number;
  message: string;
  stack?: string;
  context: {
    url: string;
    version: string;
    type: 'content' | 'background';
  };
  count: number;
}

export const STORAGE_KEY = 'webmarker_error_logs';
export const MAX_LOGS = 50;
```

- [ ] **Step 2: 实现存取与格式化逻辑**

```typescript
// src/logic/errorCollector.ts (续)
export async function collectError(error: Error | any, type: 'content' | 'background') {
  const logs: ErrorLog[] = await getLogs();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  
  const existingIndex = logs.findIndex(log => log.message === message && log.stack === stack);
  
  if (existingIndex !== -1) {
    logs[existingIndex].count += 1;
    logs[existingIndex].timestamp = Date.now();
  } else {
    logs.unshift({
      timestamp: Date.now(),
      message,
      stack,
      context: {
        url: window.location.href,
        version: '1.0.0', // 后续可从 manifest 读取
        type
      },
      count: 1
    });
  }
  
  if (logs.length > MAX_LOGS) logs.pop();
  await chrome.storage.local.set({ [STORAGE_KEY]: logs });
}

export async function getLogs(): Promise<ErrorLog[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}
```

- [ ] **Step 3: Commit**

```bash
git add src/logic/errorCollector.ts
git commit -m "feat: implement ErrorCollector logic"
```

### Task 2: 挂载全局监听器

**Files:**
- Modify: `src/background/main.ts`
- Modify: `src/contentScripts/index.ts`

- [ ] **Step 1: 修改 Background 入口**

```typescript
// src/background/main.ts
import { collectError } from '../logic/errorCollector'

window.addEventListener('error', (event) => collectError(event.error, 'background'))
window.addEventListener('unhandledrejection', (event) => collectError(event.reason, 'background'))
```

- [ ] **Step 2: 修改 ContentScript 入口**

```typescript
// src/contentScripts/index.ts
import { collectError } from '../logic/errorCollector'

window.addEventListener('error', (event) => collectError(event.error, 'content'))
window.addEventListener('unhandledrejection', (event) => collectError(event.reason, 'content'))
```

- [ ] **Step 3: Commit**

```bash
git add src/background/main.ts src/contentScripts/index.ts
git commit -m "feat: attach global error listeners"
```

### Task 3: 实现导出功能 UI

**Files:**
- Modify: `src/options/Options.vue`

- [ ] **Step 1: 添加导出按钮 UI**

```vue
<!-- src/options/Options.vue -->
<template>
  <button @click="exportLogs">导出错误日志</button>
</template>

<script setup lang="ts">
import { getLogs } from '../logic/errorCollector'

async function exportLogs() {
  const logs = await getLogs()
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `error-logs-${Date.now()}.json`
  a.click()
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/options/Options.vue
git commit -m "feat: add export error logs button"
```
