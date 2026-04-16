# 错误捕获、收集与导出功能 (Error Collection & Export)

## 变更日志
- **2026-04-16**: 实现统一错误收集模块 (`ErrorCollector`)，支持 Background 和 Content Script 异常拦截，并添加 Options 页面导出入口。

## 架构说明
- **存储**: 使用 `chrome.storage.local`，键名为 `webmarker_error_logs`。
- **限制**: 最大存储 50 条记录，基于堆栈特征去重计数。
- **导出**: 输出 JSON 文件，包含时间戳、消息、堆栈及环境信息。

## 验证证据
- [x] 全局错误监听器（Content/Background）已挂载并能捕获异常。
- [x] 错误日志数据结构符合设计规范，去重逻辑运行正常。
- [x] Options 页面“导出错误日志”按钮功能已实现并可正确下载 JSON 文件。
- [x] 已更新 `CHANGELOG.md` 及设计文档。
