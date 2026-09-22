# Archive Decision — 中间决策归档助手 (PowerShell)
# 用法: .\scripts\archive-decision.ps1 "<标题>" "<决策>" "<理由>" "<影响>"

$TITLE = $args[0]
if (-not $TITLE) { $TITLE = "Untitled Decision" }

$DECISION = $args[1]
if (-not $DECISION) { $DECISION = "" }

$REASON = $args[2]
if (-not $REASON) { $REASON = "" }

$IMPACT = $args[3]
if (-not $IMPACT) { $IMPACT = "" }

$DATE = Get-Date -Format "yyyy-MM-dd"
$SLUG = ($TITLE.ToLower() -replace '[^a-z0-9]', '-')
$SLUG = $SLUG -replace '-+', '-'
if ($SLUG -eq "" -or $SLUG -eq "-") {
    $SLUG = "decision"
} elseif ($SLUG.Length -gt 40) {
    $SLUG = $SLUG.Substring(0, 40)
}
$FILENAME = "docs/superpowers/decisions/${DATE}-${SLUG}.md"

New-Item -ItemType Directory -Force -Path "docs/superpowers/decisions" | Out-Null

$CONTENT = @"# Decision: ${TITLE}

**时间**: ${DATE}
**触发**: 用户指出 / AI 自我修正 / 跨任务关联
**决策**: ${DECISION}
**理由**: ${REASON}
**影响**: ${IMPACT}
"@

Set-Content -Path $FILENAME -Value $CONTENT -Encoding UTF8
Write-Host "✅ 决策已归档: $FILENAME"
