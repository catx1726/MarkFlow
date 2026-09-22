#!/bin/bash
set -e

# Archive Decision — 中间决策归档助手
# 用法: bash scripts/archive-decision.sh "<标题>" "<决策>" "<理由>" "<影响>"
# 示例:
#   bash scripts/archive-decision.sh \
#     "使用 Zod 替代 Yup" \
#     "所有表单校验统一使用 Zod" \
#     "Zod 与 TypeScript 集成更好" \
#     "影响 src/validation/ 目录"

TITLE="${1:-Untitled Decision}"
DECISION="${2:-}"
REASON="${3:-}"
IMPACT="${4:-}"
DATE=$(date +%Y-%m-%d)
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g' | head -c 40)
if [ -z "$SLUG" ]; then
  SLUG="decision"
fi
FILENAME="docs/superpowers/decisions/${DATE}-${SLUG}.md"

mkdir -p docs/superpowers/decisions

cat > "$FILENAME" <<EOF
# Decision: ${TITLE}

**时间**: ${DATE}
**触发**: 用户指出 / AI 自我修正 / 跨任务关联
**决策**: ${DECISION}
**理由**: ${REASON}
**影响**: ${IMPACT}
EOF

echo "✅ 决策已归档: $FILENAME"
