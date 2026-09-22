# Generate Handoff — 生成标准化上下文交接文档 (PowerShell)
# 用法: .\scripts\generate-handoff.ps1 <task-id> [status]
# 示例: .\scripts\generate-handoff.ps1 T-123 in_progress

$TASK_ID = $args[0]
if (-not $TASK_ID) { $TASK_ID = "TASK-UNKNOWN" }

$STATUS = $args[1]
if (-not $STATUS) { $STATUS = "in_progress" }

$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
$DATE = Get-Date -Format "yyyy-MM-dd"
$FILENAME = "docs/superpowers/handoffs/${TASK_ID}-${TIMESTAMP}.md"

New-Item -ItemType Directory -Force -Path "docs/superpowers/handoffs" | Out-Null

$CONTENT = @"
---
handoff_id: ${TASK_ID}-${TIMESTAMP}
source_session: $env:USERNAME@$env:COMPUTERNAME
target_session: <新会话标识>
status: ${STATUS}
created_at: ${DATE}
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
<!-- 必须链接到 docs/superpowers/decisions/ 下的归档文件；若有未归档决策，先用 scripts/archive-decision 留档 -->
- 决策 1：[链接到决策归档文件 docs/superpowers/decisions/xxx.md]
- 决策 2：简要描述

## 已知陷阱
<!-- 新会话必须避开的坑 -->
- 陷阱 1：...
- 陷阱 2：...

## 文件地图
<!-- 新增/修改的关键文件 -->
| 文件 | 状态 | 说明 |
|------|------|------|
| \`src/xxx.ts\` | 新增 | 实现了 Y 功能 |
| \`docs/xxx.md\` | 修改 | 更新了 Z 规范 |

## 引用文档
<!-- 详细内容已 offloading 到这些文件 -->
- [调研报告](docs/superpowers/handoffs/xxx.md)
- [分析结果](docs/superpowers/analysis/yyy.md)
"@

Set-Content -Path $FILENAME -Value $CONTENT -Encoding UTF8
Write-Host "✅ Handoff 已生成: $FILENAME"
Write-Host "   请编辑该文件，填充任务目标、已完成工作、待办工作等章节。"
