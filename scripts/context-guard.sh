#!/bin/bash
set -e

# Context Guard — 上下文健康度检查器
# 用法: bash scripts/context-guard.sh [--tokens N]
#       或设置环境变量 CONTEXT_TOKENS=N（N 为 AI 自报的上下文 token 用量）
# 返回: exit 0=NONE, 1=COMPACTION, 2=OFFLOADING, 3=RESET

SESSION_FILE=".project/context-session.json"

# 0. 解析 AI 自报的上下文用量（--tokens N 或环境变量 CONTEXT_TOKENS）
TOKENS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tokens) TOKENS="$2"; shift 2 ;;
    *) shift ;;
  esac
done
if [ -z "$TOKENS" ] && [ -n "$CONTEXT_TOKENS" ]; then
  TOKENS="$CONTEXT_TOKENS"
fi
# 非正整数视为未提供
if [ -n "$TOKENS" ] && ! echo "$TOKENS" | grep -qE '^[0-9]+$'; then
  TOKENS=""
fi
if [ -n "$TOKENS" ]; then TOKENS_TEXT="$TOKENS"; else TOKENS_TEXT="not reported"; fi

# 1. 计算已修改文件数（含未跟踪）
MODIFIED=$(git status --short 2>/dev/null | wc -l | tr -d ' ')

# 2. 计算已耗时（分钟）；session 文件缺失或为未初始化占位符时视为未知
ELAPSED_MIN=-1
ELAPSED_TEXT="unknown"
if [ -f "$SESSION_FILE" ]; then
  TASK_ID=$(python3 -c "import json; print(json.load(open('$SESSION_FILE')).get('task_id',''))" 2>/dev/null || echo "")
  STARTED_AT=$(python3 -c "import json; print(json.load(open('$SESSION_FILE')).get('started_at') or '')" 2>/dev/null || echo "")
  if [ -n "$STARTED_AT" ] && [ "$TASK_ID" != "TASK-XXX" ]; then
    START_EPOCH=$(date -d "$STARTED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${STARTED_AT%%+*}" +%s 2>/dev/null || true)
    NOW_EPOCH=$(date +%s)
    if [ -n "$START_EPOCH" ]; then
      ELAPSED_MIN=$(( (NOW_EPOCH - START_EPOCH) / 60 ))
      ELAPSED_TEXT="${ELAPSED_MIN} min"
    fi
  fi
fi

# 3. 计算 handoff / decision 数量
HANDOFFS=$(ls docs/superpowers/handoffs/*.md 2>/dev/null | wc -l | tr -d ' ')
DECISIONS=$(ls docs/superpowers/decisions/*.md 2>/dev/null | wc -l | tr -d ' ')

# 4. 决策逻辑（token 用量是最直接的上下文健康信号，优先判断；未提供时退回既有指标）
SUGGESTION="NONE"
REASON="上下文健康。"
EXIT_CODE=0

if [ -n "$TOKENS" ] && [ "$TOKENS" -ge 256000 ]; then
  SUGGESTION="RESET"
  REASON="上下文用量 >=256k，存在发散风险"
  EXIT_CODE=3
elif [ -n "$TOKENS" ] && [ "$TOKENS" -ge 128000 ]; then
  SUGGESTION="OFFLOADING"
  REASON="上下文用量 >=128k"
  EXIT_CODE=2
elif [ "$ELAPSED_MIN" -ge 120 ] || [ "$MODIFIED" -ge 40 ] || [ "$HANDOFFS" -ge 3 ]; then
  SUGGESTION="RESET"
  REASON="触发条件: >=120min 或 >=40 files 或 >=3 handoffs"
  EXIT_CODE=3
elif [ "$ELAPSED_MIN" -ge 60 ] || [ "$MODIFIED" -ge 25 ] || [ "$DECISIONS" -ge 5 ]; then
  SUGGESTION="OFFLOADING"
  REASON="触发条件: >=60min 或 >=25 files 或 >=5 decisions"
  EXIT_CODE=2
elif [ "$ELAPSED_MIN" -ge 30 ] || [ "$MODIFIED" -ge 10 ] || [ "$DECISIONS" -ge 3 ]; then
  SUGGESTION="COMPACTION"
  REASON="触发条件: >=30min 或 >=10 files 或 >=3 decisions"
  EXIT_CODE=1
fi

# 5. 输出仪表盘
echo "╔══════════════════════════════════════════╗"
echo "║       Context Health Dashboard           ║"
echo "╠══════════════════════════════════════════╣"
printf "║  %-20s : %-16s ║\n" "Context Tokens" "$TOKENS_TEXT"
printf "║  %-20s : %-16s ║\n" "Elapsed Time" "$ELAPSED_TEXT"
printf "║  %-20s : %-16s ║\n" "Modified Files" "$MODIFIED"
printf "║  %-20s : %-16s ║\n" "Handoff Docs" "$HANDOFFS"
printf "║  %-20s : %-16s ║\n" "Decision Archives" "$DECISIONS"
echo "╠══════════════════════════════════════════╣"
printf "║  %-20s : %-16s ║\n" "Suggestion" "$SUGGESTION"
printf "║  %-20s : %-16s ║\n" "Reason" "${REASON:0:30}"
echo "╚══════════════════════════════════════════╝"

# 6. 联动提示：建议非 NONE 时，先归档未留档决策再执行上下文管理动作
if [ "$SUGGESTION" != "NONE" ]; then
  echo ""
  echo "→ 提示: 先用 scripts/archive-decision 将未归档的关键决策留档到 docs/superpowers/decisions/"
fi

exit $EXIT_CODE
