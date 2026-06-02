#!/bin/bash
set -e

# Audit Log Pre-Commit Guard
# 原则：如果存在需要审计的变更，必须同时更新 .project/ops_changelog.md

STAGED=$(git diff --cached --name-only)

# 排除目录：纯文档/配置/自动化生成文件
CHANGES=$(echo "$STAGED" | grep -vE '^(\.github/|README\.md|docs/|CHANGELOG\.md|\.gemini/)' || true)

if [ -z "$CHANGES" ]; then
    exit 0
fi

# 检查 ops_changelog 是否在 staged files 中
LOG_CHANGED=$(echo "$STAGED" | grep '\.project/ops_changelog\.md' || true)

if [ -z "$LOG_CHANGED" ]; then
    echo ""
    echo "❌ 检测到需要审计的变更，但未更新 .project/ops_changelog.md！"
    echo ""
    echo "变更文件："
    echo "$CHANGES"
    echo ""
    echo "请在提交前按 meta-safe-executor 协议追加审计记录："
    echo "  1. read_file .project/ops_changelog.md"
    echo "  2. cp .project/ops_changelog.md .project/ops_changelog.md.bak"
    echo "  3. append 操作意图到 .project/ops_changelog.md"
    echo "  4. read_file .project/ops_changelog.md 确认行数增加"
    echo "  5. rm .project/ops_changelog.md.bak"
    echo ""
    exit 1
fi

echo "✅ 审计日志已更新。"
exit 0
