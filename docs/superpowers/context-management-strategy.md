# 上下文管理策略 (Context Management Strategy)

## 1. 问题定义

AI 在长程任务中会出现两种系统性失效：

| 失效模式 | 表现 | 根本原因 |
|---------|------|---------|
| **Context Rot（上下文腐烂）** | 遗忘早期决策、重复已完成的分析、偏离原始目标 | 上下文窗口填满后，模型无法准确召回早期信息 |
| **Context Anxiety（上下文焦虑）** | 在任务未真正完成时 prematurely wrapping up，声称"完成" | 模型感知到上下文窗口限制，主动压缩工作范围 |

> "As the context window fills, agents begin wrapping up tasks prematurely —
> not because the work is done, but because they sense the window limit
> approaching." — Cognition, Devin rebuild report

## 2. 策略总览：三种手段

```text
轻 ──────────────────────────────> 重

Compaction        Offloading         Reset
(同会话压缩)      (移出会话)         (新建会话)
  │                  │                 │
  ▼                  ▼                 ▼
保留摘要           写入文件           Handoff 文件
删除细节           会话只留引用       新会话接续
```

| 策略 | 适用场景 | 成本 | 信息保真度 |
|------|---------|------|-----------|
| **Compaction** | 同一会话内，上下文臃肿但未失效 | 低 | 中（摘要丢失细节） |
| **Offloading** | 大段分析/调研内容需要保留但不需要实时访问 | 中 | 高（完整写入文件） |
| **Reset** | 上下文已失效、AI 出现焦虑症状、任务跨度太长 | 高 | 高（结构化 handoff） |

## 3. 触发条件

**必须立即执行上下文管理的信号（满足任一）：**

- [ ] 连续执行时间超过 **60 分钟**
- [ ] 修改/读取文件超过 **25 个**
- [ ] AI 开始重复之前已完成的分析（"让我再检查一下..."但结论相同）
- [ ] AI 在任务未完成时声称"完成"或"总结"
- [ ] AI 主动提出"由于上下文限制，我简要说明..."
- [ ] Todo list 超过 **10 个活跃项**且大量已完成但未清理

**建议执行上下文管理的信号：**

- [ ] 执行时间超过 **30 分钟**
- [ ] 已生成超过 **3 份 handoff/调研文档**

## 4. Compaction 策略

在同一会话内压缩上下文，**不中断工作流**。

### 4.1 操作步骤

1. **精简 Todo List**：将已完成的子任务折叠为一句话总结，只保留待办项
2. **决策归档**：将已做出的关键决策写入 `docs/superpowers/decisions/<task-id>.md`，
   会话中只保留引用链接
3. **删除已完成分支的上下文**：如某子任务已完成，删除其详细分析过程，
   只保留结论

### 4.2 决策归档格式

```markdown
# Task-XXX 关键决策记录

## 已确认决策
| 决策 | 理由 | 时间 |
|------|------|------|
| 使用 X 而非 Y | Z 理由 | 2026-05-28 |

## 已排除选项
| 选项 | 排除理由 |
|------|---------|
| 选项 A | 成本过高 |
```

## 5. Offloading 策略

将大段内容移出会话，**写入文件**。

### 5.1 适用内容

- 调研报告（如 Harness Engineering 调研）
- 代码分析结果（如 Logic MRI 输出）
- 长段错误日志分析

### 5.2 操作步骤

1. 将完整内容写入文件（如 `docs/superpowers/handoffs/xxx.md`）
2. 在会话中删除详细内容
3. 替换为引用："详细分析见 [文件路径]"

## 6. 中间决策留档（Interim Decision Archiving）

**为什么不在 `meta-distiller`（任务尾部）留档？**

`meta-distiller` 位于生命周期尾部（Distill & Close），此时会话已接近尾声，
很多中间决策早已腐烂或丢失。日常讨论中的认知迭代必须在**产生时立即留档**。

### 6.1 触发条件（满足任一即留档）

- [ ] AI **修正了之前的理解**（"我之前说错了，正确的理解是..."）
- [ ] 用户提出了**新的约束或变更**（范围变更、优先级调整）
- [ ] 产生了**跨任务影响**的决策（影响其他模块、需要后续任务引用）
- [ ] 识别出了 **recurring pattern**（可复用到其他项目的模式）
- [ ] 用户对 AI 的输出提出了**根本性修正**

### 6.2 留档方式

#### 方式 A：追加到当前任务 handoff

如果当前任务已有 handoff 文件（如调研报告），直接追加：

```markdown
### Amendment N: <一句话描述决策>

**时间**: 2026-05-28
**决策**: ...
**理由**: ...
**影响**: ...
```

#### 方式 B：写入决策归档目录

如果当前没有 handoff 文件，写入专用目录：

```text
docs/superpowers/decisions/<yyyy-mm-dd>-<brief-title>.md
```

### 6.3 最小留档格式

不需要完整报告，只需要：

```markdown
# Decision: <一句话>

**时间**: 2026-05-28
**触发**: 用户指出 / AI 自我修正 / 跨任务关联
**决策**: <具体决策内容>
**理由**: <为什么改变>
**影响**: <影响哪些文件、哪些后续任务>
```

### 6.4 与 meta-distiller 的关系

- **中间决策留档**：发生在执行阶段，**即时**、**轻量**
- **meta-distiller**：发生在任务尾部，**全面**、**系统**
- meta-distiller 应该**引用**中间决策留档，而不是重复记录

---

## 7. Reset 策略

**最彻底的策略**：结束当前会话，新建会话，通过 handoff 文件传递状态。

### 6.1 触发条件（比 compaction 更严格）

- 任务已执行超过 **2 小时**
- AI 多次出现 context anxiety 症状
- 任务涉及多个独立的子系统，上下文互相干扰

### 6.2 Handoff 文件格式

```markdown
---
handoff_id: <task-id>-<timestamp>
source_session: <原会话标识>
target_session: <新会话标识>
status: in_progress
---

# 上下文交接文档

## 任务目标（一句话）
<!-- 用一句话概括当前任务的最终目标 -->

## 已完成工作
<!-- 只保留结论，不保留过程 -->
- [x] 子任务 A：结论是什么
- [x] 子任务 B：结论是什么

## 待办工作
<!-- 只保留下一步行动，不保留背景 -->
- [ ] 子任务 C：需要做什么
- [ ] 子任务 D：需要做什么

## 关键决策
<!-- 已做出的、新会话必须知道的决策 -->
- 决策 1：[链接到决策归档文件]
- 决策 2：简要描述

## 已知陷阱
<!-- 新会话必须避开的坑 -->
- 陷阱 1：...
- 陷阱 2：...

## 文件地图
<!-- 新增/修改的关键文件 -->
| 文件 | 状态 | 说明 |
|------|------|------|
| `src/xxx.ts` | 新增 | 实现了 Y 功能 |
| `docs/xxx.md` | 修改 | 更新了 Z 规范 |

## 引用文档
<!-- 详细内容已 offloading 到这些文件 -->
- [调研报告](docs/superpowers/handoffs/xxx.md)
- [分析结果](docs/superpowers/analysis/yyy.md)
```

### 6.3 Reset 后的会话启动话术

新会话启动时，AI 应：

1. 阅读 handoff 文件
2. 确认理解当前状态
3. 不重复 handoff 中已记录的分析
4. 直接继续待办工作

## 8. 与生命周期的整合

将上下文管理嵌入 `lifecycle.md` 的各阶段：

| 生命周期阶段 | 上下文管理动作 | 策略 |
|-------------|--------------|------|
| **Launch** | brainstorming 产出写入 Spec 文件 | Offloading |
| **Plan** | writing-plans 产出写入 Plan 文件 | Offloading |
| **Act** | 每完成 3-5 个 subtask 执行一次 compaction | Compaction |
| **Act（长任务）** | 超过 1h 时执行 Reset + handoff | Reset |
| **Verify** | verification 证据写入文件，会话只留摘要 | Offloading |
| **Distill** | meta-distiller 产出写入 Staging | Offloading |
| **Close** | 最终 handoff 归档 | Reset |

## 9. 具体执行 Checklist

当触发条件满足时，按以下顺序执行：

```markdown
- [ ] Step 1: 判断策略（Compaction / Offloading / Reset）
- [ ] Step 2: 执行对应的上下文管理动作
- [ ] Step 3: 更新 todo list（精简为活跃项）
- [ ] Step 4: 如果执行 Reset，生成 handoff 文件
- [ ] Step 5: 如果执行 Reset，在新会话中阅读 handoff 并确认接续
- [ ] Step 6: 更新 ops_changelog 记录上下文管理事件
```

## 10. Red Flags

**禁止：**

- ❌ 在上下文明显腐烂时继续堆砌内容
- ❌ Reset 时 handoff 文件丢失关键决策
- ❌ Compaction 时删除待办项（只删除已完成的）
- ❌ 新会话不阅读 handoff 就声称"我了解了"
- ❌ 同一任务 Reset 超过 3 次（说明任务拆分过粗）

**危险信号：**

- 🟡 AI 说"让我简要总结"——可能是 context anxiety 前兆
- 🟡 AI 开始重复之前的分析——context rot 症状
- 🟡 AI 遗忘了 10 分钟前做的决策——必须立即 compaction
