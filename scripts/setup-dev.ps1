# 开发环境一键安装脚本 (PowerShell)
# - 安装 lefthook
# - 注册 Git hooks
# - 验证安装结果

Write-Host "🔧 Setting up development environment..."

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is required but not installed."
    Write-Host "   Please install Node.js (https://nodejs.org) and retry."
    exit 1
}

# 2. Install lefthook
echo "📦 Installing lefthook..."
npx lefthook install

# 3. Verify hooks are registered
echo "🔍 Verifying hooks..."
if (Test-Path ".git/hooks/pre-commit") {
    Write-Host "   ✅ pre-commit hook registered"
} else {
    Write-Host "   ❌ pre-commit hook missing"
    exit 1
}

if (Test-Path ".git/hooks/commit-msg") {
    Write-Host "   ✅ commit-msg hook registered"
} else {
    Write-Host "   ❌ commit-msg hook missing"
    exit 1
}

# 4. Quick validation test
echo "🧪 Running quick validation..."
bash scripts/check-agents-md.sh 2>$null
if ($LASTEXITCODE -ne 0) {
    powershell -File scripts/check-agents-md.ps1
}

Write-Host ""
Write-Host "✅ Setup complete! Your commits are now guarded by:"
Write-Host "   • AGENTS.md size check (≤ 100 lines)"
Write-Host "   • Destructive command detection"
Write-Host "   • Conventional Commit enforcement"
