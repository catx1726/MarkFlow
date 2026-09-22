#!/bin/bash
set -e

# Surgical Workflow Check — 工作流选择辅助判断器
# 用法: bash scripts/surgical-check.sh "<用户任务描述>"
# 输出: SURGICAL 或 STANDARD + 量化指标 + 理由
# 注意: 本脚本为辅助参考，AI 应结合实际情况做最终决策

INPUT="${1:-}"
LOWER_INPUT=""
if [ -n "$INPUT" ]; then
  LOWER_INPUT=$(echo "$INPUT" | tr '[:upper:]' '[:lower:]')
fi

# 1. 范围预估（基于关键词）
# 小型修复/调整关键词
SMALL_KEYWORDS="fix|bug|typo|css|style|rename|move|delete|remove|update|adjust|tweak|patch|hotfix|lint|format|comment|doc|log|error|warn|console|spelling|grammar|alignment|spacing|indent|color|font|size|width|height|margin|padding|align|position|display|overflow|z-index|background|border|shadow|opacity|transform|transition|animation"
# 大型功能/架构关键词
LARGE_KEYWORDS="feature|implement|add.*new|create.*new|build.*new|design|architecture|refactor|migrate|upgrade|redesign|restructure|introduce|integrate|framework|library|module|system|platform|service|component|plugin|extension|tool|utility|helper|manager|controller|handler|middleware|repository|dao|dto|vo|entity|model|domain|aggregate|event|command|query|saga|workflow|pipeline"
# 架构变更风险关键词
ARCH_KEYWORDS="database|schema|table|column|index|migration|foreign key|primary key|api|endpoint|route|middleware|dependency|package|config|environment|env|variable|secret|token|key|certificate|ssl|tls|oauth|jwt|auth|permission|role|policy|gateway|proxy|cache|redis|message queue|kafka|rabbitmq|event bus|websocket|grpc|graphql|rest|openapi|swagger|protobuf|json schema|docker|kubernetes|k8s|helm|terraform|cloud|aws|azure|gcp|serverless|lambda|ci/cd|pipeline|github action|jenkins|gitlab"
# 目标明确度指标（具体文件/组件/行为）
SPECIFIC_KEYWORDS="file|function|class|method|component|page|route|api|endpoint|variable|constant|config|setting|button|form|modal|table|list|header|footer|sidebar|nav|menu|tab|card|chart|graph|image|icon|error|exception|crash|fail|timeout|slow|memory|leak|should|must|need to|expected|want to|would like|please make|please fix|please add|please remove|please update|please change|please adjust|please modify|please rename|please move|please delete"

SMALL_SCORE=0
LARGE_SCORE=0
ARCH_SCORE=0
SPECIFIC_SCORE=0

if [ -n "$LOWER_INPUT" ]; then
  SMALL_SCORE=$(echo "$LOWER_INPUT" | grep -oE "$SMALL_KEYWORDS" | wc -l | tr -d ' ')
  LARGE_SCORE=$(echo "$LOWER_INPUT" | grep -oE "$LARGE_KEYWORDS" | wc -l | tr -d ' ')
  ARCH_SCORE=$(echo "$LOWER_INPUT" | grep -oE "$ARCH_KEYWORDS" | wc -l | tr -d ' ')
  SPECIFIC_SCORE=$(echo "$LOWER_INPUT" | grep -oE "$SPECIFIC_KEYWORDS" | wc -l | tr -d ' ')
fi

# 2. 决策逻辑
SUGGESTION="STANDARD"
REASON=""

if [ -z "$INPUT" ]; then
  SUGGESTION="STANDARD"
  REASON="未提供任务描述，无法判断范围。为降低风险，建议标准生命周期。"
elif [ "$ARCH_SCORE" -ge 2 ]; then
  SUGGESTION="STANDARD"
  REASON="检测到架构/数据模型相关关键词（$ARCH_SCORE 个），建议标准生命周期以确保充分规划。"
elif [ "$LARGE_SCORE" -ge 2 ] && [ "$SMALL_SCORE" -le 1 ]; then
  SUGGESTION="STANDARD"
  REASON="检测到大型变更关键词（$LARGE_SCORE 个），且无明显小型修复特征。"
elif [ "$SMALL_SCORE" -ge 1 ] && [ "$LARGE_SCORE" -eq 0 ] && [ "$ARCH_SCORE" -eq 0 ]; then
  SUGGESTION="SURGICAL"
  REASON="检测到小型修复/调整关键词（$SMALL_SCORE 个），无架构变更风险。"
elif [ "$SPECIFIC_SCORE" -ge 3 ] && [ "$ARCH_SCORE" -eq 0 ] && [ "$LARGE_SCORE" -eq 0 ]; then
  SUGGESTION="SURGICAL"
  REASON="目标描述较明确（$SPECIFIC_SCORE 个具体指标），且无架构变更风险。"
else
  SUGGESTION="STANDARD"
  REASON="无法明确判定为小型修复。为降低风险，建议标准生命周期。"
fi

# 3. 输出仪表盘
echo "╔══════════════════════════════════════════╗"
echo "║     Surgical Workflow Check              ║"
echo "╠══════════════════════════════════════════╣"
printf "║  %-20s : %-16s ║\n" "Suggestion" "$SUGGESTION"
printf "║  %-20s : %-16s ║\n" "Small Signals" "$SMALL_SCORE"
printf "║  %-20s : %-16s ║\n" "Large Signals" "$LARGE_SCORE"
printf "║  %-20s : %-16s ║\n" "Specific Signals" "$SPECIFIC_SCORE"
printf "║  %-20s : %-16s ║\n" "Arch Risk" "$ARCH_SCORE"
echo "╠══════════════════════════════════════════╣"
printf "║  %-20s : %-16s ║\n" "Reason" "${REASON:0:30}"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "⚠️ 注意：本脚本为辅助判断。AI 应结合以下因素做最终决策："
echo "   - 预估修改文件数是否 ≤10"
echo "   - 是否涉及接口/数据模型/依赖关系变更"
echo "   - 修改对象是否为已存在的功能"
echo "   - 若存在 handoff 文件或跨任务依赖，仍建议 STANDARD"
