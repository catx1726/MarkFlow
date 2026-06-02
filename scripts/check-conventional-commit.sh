#!/usr/bin/env bash
# 检查 commit message 是否符合 Conventional Commits 规范
# Usage: check-conventional-commit.sh <commit-msg-file>

MSG_FILE="${1:-.git/COMMIT_EDITMSG}"

if [ ! -f "$MSG_FILE" ]; then
  echo "❌ Commit message file not found: $MSG_FILE"
  exit 1
fi

# 读取第一行（忽略注释和空行）
MSG=$(grep -v "^#" "$MSG_FILE" | grep -v "^$" | head -n 1)

if [ -z "$MSG" ]; then
  echo "❌ Commit message is empty"
  exit 1
fi

if ! echo "$MSG" | grep -qE '^(feat|fix|docs|style|refactor|test|chore|ci|revert)(\(.+\))?: .+'; then
  echo "❌ Commit message must follow Conventional Commits"
  echo "   Current: $MSG"
  echo "   Example: feat(auth): add login endpoint"
  exit 1
fi

echo "✅ Commit message follows Conventional Commits"
exit 0
