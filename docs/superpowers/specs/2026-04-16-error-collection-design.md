# 错误捕获、收集与导出功能设计规范

## 1. 概述
为提升用户反馈问题的排查效率，本项目将增加一个统一的错误捕获与日志导出功能。该功能在后台静默收集异常，并提供手动导出供用户发送给开发团队。

## 2. 架构设计
- **捕获层**: 全局拦截 window 级异常及 Promise 拒绝。
- **存储层**: 使用 `chrome.storage.local` 持久化存储异常日志。
- **导出层**: 在设置页或侧边栏提供 JSON 格式日志导出。

## 3. 技术方案
### 3.1 异常拦截
在 `background` 和 `contentScripts` 入口处实现统一的错误处理：
```typescript
window.addEventListener('error', (event) => { ... });
window.addEventListener('unhandledrejection', (event) => { ... });
```

### 3.2 数据结构 (ErrorLog)
```typescript
interface ErrorLog {
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
```

### 3.3 存储逻辑
- 限制最大存储量（50条）。
- 堆栈去重：若新错误堆栈与最近一条相同，更新 `count` 字段。

### 3.4 导出功能
- 提供 JSON 下载。
- 日志包含：错误内容、堆栈、发生时间、浏览器环境/插件版本。

## 4. 落地步骤
1. 创建 `src/logic/errorCollector.ts`。
2. 在各入口文件挂载监听。
3. 在 Sidepanel/Options 页面实现 UI 导出入口。
