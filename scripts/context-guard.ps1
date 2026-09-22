# Context Guard — 上下文健康度检查器 (PowerShell)
# 用法: .\scripts\context-guard.ps1 --tokens N
#       或设置环境变量 CONTEXT_TOKENS=N（N 为 AI 自报的上下文 token 用量）
# 返回: exit 0=NONE, 1=COMPACTION, 2=OFFLOADING, 3=RESET

$SESSION_FILE = ".project/context-session.json"

# 0. 解析 AI 自报的上下文用量（--tokens N 或环境变量 CONTEXT_TOKENS）
$TOKENS = $null
for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -eq "--tokens" -and ($i + 1) -lt $args.Count) {
        $TOKENS = "$($args[$i + 1])"
        $i++
    }
}
if (-not $TOKENS -and $env:CONTEXT_TOKENS) { $TOKENS = "$env:CONTEXT_TOKENS" }
# 非正整数视为未提供
if ($TOKENS -and $TOKENS -notmatch '^\d+$') { $TOKENS = $null }
if ($TOKENS) { $TOKENS_TEXT = $TOKENS } else { $TOKENS_TEXT = "not reported" }

# 1. 计算已修改文件数
$MODIFIED = (git status --short 2>$null | Measure-Object).Count

# 2. 计算已耗时（分钟）；session 文件缺失或为未初始化占位符时视为未知
$ELAPSED_MIN = -1
$ELAPSED_TEXT = "unknown"
if (Test-Path $SESSION_FILE) {
    $json = Get-Content $SESSION_FILE -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($json.started_at -and $json.task_id -ne "TASK-XXX") {
        try {
            $STARTED = [datetime]::Parse($json.started_at)
            $ELAPSED_MIN = [math]::Floor(((Get-Date) - $STARTED).TotalMinutes)
            $ELAPSED_TEXT = "${ELAPSED_MIN} min"
        } catch { }
    }
}

# 3. 计算 handoff / decision 数量
$HANDOFFS = (Get-ChildItem "docs/superpowers/handoffs/*.md" -ErrorAction SilentlyContinue).Count
$DECISIONS = (Get-ChildItem "docs/superpowers/decisions/*.md" -ErrorAction SilentlyContinue).Count

# 4. 决策逻辑（token 用量是最直接的上下文健康信号，优先判断；未提供时退回既有指标）
$SUGGESTION = "NONE"
$REASON = "上下文健康。"
$EXIT_CODE = 0

if ($TOKENS -and [long]$TOKENS -ge 256000) {
    $SUGGESTION = "RESET"
    $REASON = "上下文用量 >=256k，存在发散风险"
    $EXIT_CODE = 3
} elseif ($TOKENS -and [long]$TOKENS -ge 128000) {
    $SUGGESTION = "OFFLOADING"
    $REASON = "上下文用量 >=128k"
    $EXIT_CODE = 2
} elseif ($ELAPSED_MIN -ge 120 -or $MODIFIED -ge 40 -or $HANDOFFS -ge 3) {
    $SUGGESTION = "RESET"
    $REASON = "触发条件: >=120min 或 >=40 files 或 >=3 handoffs"
    $EXIT_CODE = 3
} elseif ($ELAPSED_MIN -ge 60 -or $MODIFIED -ge 25 -or $DECISIONS -ge 5) {
    $SUGGESTION = "OFFLOADING"
    $REASON = "触发条件: >=60min 或 >=25 files 或 >=5 decisions"
    $EXIT_CODE = 2
} elseif ($ELAPSED_MIN -ge 30 -or $MODIFIED -ge 10 -or $DECISIONS -ge 3) {
    $SUGGESTION = "COMPACTION"
    $REASON = "触发条件: >=30min 或 >=10 files 或 >=3 decisions"
    $EXIT_CODE = 1
}

# 5. 输出仪表盘
Write-Host "╔══════════════════════════════════════════╗"
Write-Host "║       Context Health Dashboard           ║"
Write-Host "╠══════════════════════════════════════════╣"
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Context Tokens", $TOKENS_TEXT)
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Elapsed Time", $ELAPSED_TEXT)
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Modified Files", $MODIFIED)
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Handoff Docs", $HANDOFFS)
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Decision Archives", $DECISIONS)
Write-Host "╠══════════════════════════════════════════╣"
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Suggestion", $SUGGESTION)
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Reason", $REASON.Substring(0, [Math]::Min(30, $REASON.Length)))
Write-Host "╚══════════════════════════════════════════╝"

# 6. 联动提示：建议非 NONE 时，先归档未留档决策再执行上下文管理动作
if ($SUGGESTION -ne "NONE") {
    Write-Host ""
    Write-Host "→ 提示: 先用 scripts/archive-decision 将未归档的关键决策留档到 docs/superpowers/decisions/"
}

exit $EXIT_CODE
