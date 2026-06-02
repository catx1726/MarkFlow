# 检查 commit message 是否符合 Conventional Commits 规范
# Usage: check-conventional-commit.ps1 <commit-msg-file>

$MsgFile = $args[0]
if (-not $MsgFile) {
    $MsgFile = ".git/COMMIT_EDITMSG"
}

if (-not (Test-Path $MsgFile)) {
    Write-Host "❌ Commit message file not found: $MsgFile"
    exit 1
}

# 读取第一行（忽略注释和空行）
$Lines = Get-Content $MsgFile | Where-Object { $_ -notmatch "^#" -and $_ -notmatch "^$" }
$Msg = $Lines | Select-Object -First 1

if (-not $Msg) {
    Write-Host "❌ Commit message is empty"
    exit 1
}

if ($Msg -notmatch '^(feat|fix|docs|style|refactor|test|chore|ci|revert)(\(.+\))?: .+') {
    Write-Host "❌ Commit message must follow Conventional Commits"
    Write-Host "   Current: $Msg"
    Write-Host "   Example: feat(auth): add login endpoint"
    exit 1
}

Write-Host "✅ Commit message follows Conventional Commits"
exit 0
