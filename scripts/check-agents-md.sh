#!/usr/bin/env bash
# 检查 AGENTS.md 是否超过 Harness 工程建议的 100 行上限
# Ratchet: AGENTS.md 膨胀会导致系统 prompt 上下文被挤占，降低 Agent 推理质量

MAX_LINES=100
FILE="AGENTS.md"

if [ ! -f "$FILE" ]; then
  echo "❌ $FILE not found"
  exit 1
fi

LINES=$(wc -l < "$FILE" | tr -d ' ')

if [ "$LINES" -gt "$MAX_LINES" ]; then
  echo "❌ AGENTS.md has $LINES lines (max allowed: $MAX_LINES)"
  echo "   Move non-essential content to docs/superpowers/"
  exit 1
fi

echo "✅ AGENTS.md: $LINES lines (limit: $MAX_LINES)"
exit 0
