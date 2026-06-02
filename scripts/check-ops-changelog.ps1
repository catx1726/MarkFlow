# Audit Log Pre-Commit Guard (PowerShell)
# 原则：如果存在需要审计的变更，必须同时更新 .project/ops_changelog.md

$STAGED = git diff --cached --name-only

# 排除目录：纯文档/配置/自动化生成文件
$CHANGES = $STAGED | Where-Object { $_ -notmatch '^(\.github/|README\.md|docs/|CHANGELOG\.md|\.gemini/)' }

if (-not $CHANGES) {
    exit 0
}

# 检查 ops_changelog 是否在 staged files 中
$LOG_CHANGED = $STAGED | Where-Object { $_ -match '\.project/ops_changelog\.md' }

if (-not $LOG_CHANGED) {
    Write-Host ""
    Write-Host "❌ 检测到需要审计的变更，但未更新 .project/ops_changelog.md！" -ForegroundColor Red
    Write-Host ""
    Write-Host "变更文件："
    $CHANGES | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "请在提交前按 meta-safe-executor 协议追加审计记录："
    Write-Host "  1. read_file .project/ops_changelog.md"
    Write-Host "  2. cp .project/ops_changelog.md .project/ops_changelog.md.bak"
    Write-Host "  3. append 操作意图到 .project/ops_changelog.md"
    Write-Host "  4. read_file .project/ops_changelog.md 确认行数增加"
    Write-Host "  5. rm .project/ops_changelog.md.bak"
    Write-Host ""
    exit 1
}

Write-Host "✅ 审计日志已更新。" -ForegroundColor Green
exit 0
