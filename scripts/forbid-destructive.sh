#!/usr/bin/env bash
# 在 diff 中检测破坏性命令或危险模式
# 用于 pre-commit hook 和 Agent 执行前检查
# 注意：只检查实际代码文件，忽略 Markdown 文档中的示例

DANGEROUS_PATTERNS=(
  "rm -rf"
  "git push --force"
  "git push -f"
  "DROP TABLE"
  "DELETE FROM"
  ":> "
  "Clear-Content"
  "Remove-Item -Recurse"
)

FOUND=0

# 获取暂存区中的非文档文件
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -vE '\.(md|markdown)$' || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# 只在代码文件中检测危险模式
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  MATCH=$(git diff --cached -G"$pattern" --name-only --diff-filter=ACM | grep -vE '\.(md|markdown)$' 2>/dev/null || true)
  if [ -n "$MATCH" ]; then
    echo "⚠️  Potential destructive pattern detected: '$pattern'"
    echo "   Files: $MATCH"
    FOUND=1
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "If these changes are intentional, commit with --no-verify (not recommended)."
  echo "For Agent execution, escalate to Driver for approval."
  exit 1
fi

echo "✅ No destructive patterns detected in staged code files"
exit 0
