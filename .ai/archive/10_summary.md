# 📝 知识归档：Summary for Issue #10

## 1. 元数据 (Metadata)

- **Task ID**: `#10`
- **日期**: 2025-12-31
- **类型**: `FIX` / `REFACTOR`
- **涉及文件**:
- `src/sidepanel/Sidepanel.vue`
- `src/background/main.ts`
- `src/popup/Popup.vue`
- `src/options/Options.vue`

- **Breaking Changes**: `No`

---

## 2. 核心摘要 (Core Summary)

### 🚀 最终解决问题的关键点

针对 Sidepanel 连接不稳定及状态同步失效问题，实施了**“混合通信增强策略”**：

- **身份伪装 (Context Masquerading)**：将 Sidepanel 的 `webext-bridge` 上下文强制声明为 `'options'`。由于 `'popup'` 上下文随弹窗关闭即销毁，使用 `'options'` 身份可以让侧边栏复用长生命周期通道，彻底解决了连接被误杀的问题。
- **原生广播下行**：弃用 `webext-bridge` 进行一对多通知，回归浏览器原生 `browser.runtime.sendMessage`。利用原生机制无视上下文类型的特性，确保 Background 的刷新指令能百分之百触达所有活跃视图（Popup/Options/Sidepanel）。
- **数据净化**：在跨进程传输前使用 Vue 3 的 `toRaw()` 显式剥离响应式代理，解决了 `Proxy` 对象在序列化时可能触发的未知异常。

### 🧠 关键技术点 (Knowledge Points)

- **上下文生命周期对齐**：长生命周期的 UI（Sidepanel）必须对接长生命周期的通信上下文。在库版本落后（不支持 `side-panel` 原生定义）时，借用 `options` 身份是最高效的 Workaround。
- **通信健壮性设计**：
- **异常隔离**：在所有广播发送端注入 `.catch()`，确保即使接收端（如 Sidepanel）处于关闭状态，也不会因 Promise Rejection 阻塞主业务流程。
- **净化传输**：明确了“Vue 响应式对象不可跨界”的原则，统一了数据传输前的脱敏标准。

---

## 3. 沉淀与反思 (Post-mortem)

### ⚠️ 避坑指南 (Lessons Learned)

- **上下文误区的代价**：严禁让长驻页面（Sidepanel）使用 `'popup'` 标识，否则会因 Popup 的瞬间关闭导致全局 Bridge 路由表崩溃。
- **依赖版本敏感性**：`webext-bridge` 在 v5 与 v6 版本间对 Sidepanel 的支持存在断层。在排查连接问题时，**版本检查**应优于代码逻辑检查。

### 💎 复用价值

- **混合通信范式**：`webext-bridge` 负责点对点精密通信 + `browser.runtime` 负责全局状态广播。这套模式可作为未来所有多视图同步需求的标准模板。
- **数据脱敏模式**：`toRaw()` 预处理逻辑应固化到所有涉及数据持久化或跨进程发送的函数入口处。

---

## 4. 影响评估 (Impact)

- **改善模块**: `Sidepanel (侧边栏)` 稳定性、`State Synchronization`。修复了多视图操作后的数据过时问题，消除了控制台频繁出现的连接断开报错。
- **遗留技术债**:
- 🛠️ **版本升级需求**: 目前采用的“上下文伪装”属于临时规避手段。待项目稳定后，需计划升级 `webext-bridge` 至最新版本，并重构为规范的 `side-panel` 上下文定义。

---

## 5. 验证状态 (Verification)

- ✅ 在 Popup 修改笔记，Sidepanel 实时自动刷新
- ✅ Options 页面删除标记，Sidepanel 同步移除
- ✅ 反复开关 Popup，Sidepanel 连接保持活跃不报错
- ✅ 大数据量传输测试，`toRaw` 净化后无序列化错误
