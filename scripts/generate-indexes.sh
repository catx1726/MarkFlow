#!/bin/bash
set -e

# Generate Indexes — 自动生成 handoffs/ 和 decisions/ 的 INDEX.md
# 用法: bash scripts/generate-indexes.sh

generate_handoff_index() {
  local DIR="docs/superpowers/handoffs"
  local INDEX="$DIR/INDEX.md"
  
  if [ ! -d "$DIR" ]; then
    echo "⚠️ 目录不存在: $DIR"
    return
  fi
  
  local FILES=$(ls -1 "$DIR"/*.md 2>/dev/null | grep -v 'INDEX.md' | sort -r | head -20)
  if [ -z "$FILES" ]; then
    echo "<!-- 暂无 handoff 文件 -->" > "$INDEX"
    echo "✅ Handoff 索引已清空（无文件）。"
    return
  fi
  
  cat > "$INDEX" <<'EOF'
# Handoff 索引

> 按时间倒序排列，最新在前。AI 在接续任务时优先阅读最上方的 handoff。

| 文件 | 任务ID | 状态 | 时间 | 摘要 |
|------|--------|------|------|------|
EOF
  
  for f in $FILES; do
    local BASENAME=$(basename "$f")
    # 从文件名提取 task-id 和日期
    # 尝试新格式: <task-id>-YYYYMMDD-HHMMSS.md
    local TASK_ID=$(echo "$BASENAME" | sed -E 's/^([A-Za-z0-9_-]+)-[0-9]{8}-[0-9]{6}\.md$/\1/')
    local DATE_RAW=$(echo "$BASENAME" | grep -oE '[0-9]{8}-[0-9]{6}' | head -1)
    local FORMATTED_DATE=""
    
    if [ -n "$DATE_RAW" ]; then
      # 新格式日期
      FORMATTED_DATE=$(echo "$DATE_RAW" | sed 's/\(....\)\(..\)\(..\)-\(..\)\(..\)\(..\)/\1-\2-\3 \4:\5/')
    else
      # 尝试旧格式: <name>-YYYY-MM-DD.md
      DATE_RAW=$(echo "$BASENAME" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
      if [ -n "$DATE_RAW" ]; then
        FORMATTED_DATE="$DATE_RAW"
        # 旧格式的 task-id 可能是文件名去掉日期和 .md
        TASK_ID=$(echo "$BASENAME" | sed -E 's/(.+)-[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$/\1/')
      fi
    fi
    
    # 如果 task-id 还是整个文件名，说明提取失败，回退为去掉 .md 的文件名
    if [ "$TASK_ID" = "$BASENAME" ]; then
      TASK_ID="${BASENAME%.md}"
    fi
    
    # 尝试从文件提取状态和摘要
    local STATUS="unknown"
    local SUMMARY="—"
    if [ -f "$f" ]; then
      STATUS=$(grep -m1 -oE '^status:[[:space:]]*\S+' "$f" 2>/dev/null | sed 's/^status:[[:space:]]*//' || echo "unknown")
      if [ -z "$STATUS" ]; then
        STATUS=$(grep -m1 -oE 'status:[[:space:]]*\S+' "$f" 2>/dev/null | sed 's/status:[[:space:]]*//' || echo "unknown")
      fi
      # 提取任务目标（一句话），跳过 HTML 注释行
      SUMMARY=$(sed -n '/## 任务目标/,/## /p' "$f" 2>/dev/null | grep -v '^##' | grep -v '^<!--' | grep -v '^$' | head -1 | sed 's/^[[:space:]]*//' | cut -c1-40 || echo "—")
      # 如果任务目标为空，尝试提取文件第一行标题
      if [ "$SUMMARY" = "—" ] || [ -z "$SUMMARY" ]; then
        SUMMARY=$(grep -m1 '^# ' "$f" 2>/dev/null | sed 's/^# //' | cut -c1-40 || echo "—")
      fi
    fi
    
    [ -z "$STATUS" ] && STATUS="unknown"
    [ -z "$SUMMARY" ] && SUMMARY="—"
    
    echo "| [\`$BASENAME\`]($BASENAME) | $TASK_ID | $STATUS | $FORMATTED_DATE | $SUMMARY |" >> "$INDEX"
  done
  
  echo "✅ Handoff 索引已更新: $INDEX"
}

generate_decision_index() {
  local DIR="docs/superpowers/decisions"
  local INDEX="$DIR/INDEX.md"
  
  if [ ! -d "$DIR" ]; then
    echo "⚠️ 目录不存在: $DIR"
    return
  fi
  
  local FILES=$(ls -1 "$DIR"/*.md 2>/dev/null | sort -r | head -20)
  if [ -z "$FILES" ]; then
    echo "<!-- 暂无决策归档文件 -->" > "$INDEX"
    echo "✅ Decision 索引已清空（无文件）。"
    return
  fi
  
  cat > "$INDEX" <<'EOF'
# Decision 索引

> 按时间倒序排列，最新在前。

| 文件 | 日期 | 标题 | 影响 |
|------|------|------|------|
EOF
  
  for f in $FILES; do
    local BASENAME=$(basename "$f")
    local DATE=$(echo "$BASENAME" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
    # 提取标题: 去掉日期前缀和 .md 后缀，将连字符替换为空格，首字母大写
    local TITLE=$(echo "$BASENAME" | sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}-(.+)\.md$/\1/' | sed 's/-/ /g')
    # 首字母大写（简单版）
    TITLE=$(echo "$TITLE" | sed 's/\b\w/\u&/g')
    local IMPACT="—"
    
    if [ -f "$f" ]; then
      IMPACT=$(grep -A1 '^\*\*影响\*\*' "$f" 2>/dev/null | tail -1 | sed 's/^[[:space:]]*//' | cut -c1-40 || echo "—")
    fi
    
    [ -z "$IMPACT" ] && IMPACT="—"
    
    echo "| [\`$BASENAME\`]($BASENAME) | $DATE | $TITLE | $IMPACT |" >> "$INDEX"
  done
  
  echo "✅ Decision 索引已更新: $INDEX"
}

generate_handoff_index
generate_decision_index
