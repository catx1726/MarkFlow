# 在 diff 中检测破坏性命令或危险模式
# 用于 pre-commit hook 和 Agent 执行前检查
# 注意：只检查实际代码文件，忽略 Markdown 文档中的示例

$DangerousPatterns = @(
    "rm -rf",
    "git push --force",
    "git push -f",
    "DROP TABLE",
    "DELETE FROM",
    ":> ",
    "Clear-Content",
    "Remove-Item -Recurse"
)

$Found = 0

# 获取暂存区中的非文档文件
$StagedFiles = git diff --cached --name-only --diff-filter=ACM | Select-String -NotMatch '\.(md|markdown)$'

if (-not $StagedFiles) {
    exit 0
}

# 只在代码文件中检测危险模式
foreach ($pattern in $DangerousPatterns) {
    $Match = git diff --cached -G"$pattern" --name-only --diff-filter=ACM | Select-String -NotMatch '\.(md|markdown)$'
    if ($Match) {
        Write-Host "⚠️  Potential destructive pattern detected: '$pattern'"
        Write-Host "   Files: $Match"
        $Found = 1
    }
}

if ($Found -eq 1) {
    Write-Host ""
    Write-Host "If these changes are intentional, commit with --no-verify (not recommended)."
    Write-Host "For Agent execution, escalate to Driver for approval."
    exit 1
}

Write-Host "✅ No destructive patterns detected in staged code files"
exit 0
