#!/usr/bin/env bash
# 开发环境一键安装脚本
# - 安装 lefthook
# - 注册 Git hooks
# - 验证安装结果

set -euo pipefail

echo "🔧 Setting up development environment..."

# 1. Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is required but not installed."
  echo "   Please install Node.js (https://nodejs.org) and retry."
  exit 1
fi

# 2. Install lefthook globally or use npx
echo "📦 Installing lefthook..."
npx lefthook install

# 3. Verify hooks are registered
echo "🔍 Verifying hooks..."
if [ -f ".git/hooks/pre-commit" ]; then
  echo "   ✅ pre-commit hook registered"
else
  echo "   ❌ pre-commit hook missing"
  exit 1
fi

if [ -f ".git/hooks/commit-msg" ]; then
  echo "   ✅ commit-msg hook registered"
else
  echo "   ❌ commit-msg hook missing"
  exit 1
fi

# 4. Quick validation test
echo "🧪 Running quick validation..."
bash scripts/check-agents-md.sh

echo ""
echo "✅ Setup complete! Your commits are now guarded by:"
echo "   • AGENTS.md size check (≤ 100 lines)"
echo "   • Destructive command detection"
echo "   • Conventional Commit enforcement"
