# 检查 AGENTS.md 是否超过 Harness 工程建议的 100 行上限
# Ratchet: AGENTS.md 膨胀会导致系统 prompt 上下文被挤占，降低 Agent 推理质量

$MaxLines = 100
$File = "AGENTS.md"

if (-not (Test-Path $File)) {
    Write-Host "❌ $File not found"
    exit 1
}

$Lines = (Get-Content $File | Measure-Object -Line).Lines

if ($Lines -gt $MaxLines) {
    Write-Host "❌ AGENTS.md has $Lines lines (max allowed: $MaxLines)"
    Write-Host "   Move non-essential content to docs/superpowers/"
    exit 1
}

Write-Host "✅ AGENTS.md: $Lines lines (limit: $MaxLines)"
exit 0
