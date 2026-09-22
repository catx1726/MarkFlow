#!/bin/bash
# Check Adoption — 子库接入前置自检
# 用法: bash <SOP-HOME>/scripts/check-adoption.sh
# 在子库（目标项目）根目录运行；检测接入资产与工具链是否就绪
# 返回: exit 0=就绪, 1=缺接入资产, 2=缺关键工具

MISSING_ASSETS=0
MISSING_TOOLS=0

echo "============================================"
echo "  子库接入自检 (Check Adoption)"
echo "============================================"

echo ""
echo "[1/3] 接入资产（按母库 child-repo-guide.md §3 安装）"
for f in scripts/context-guard.sh lefthook.yml .github/workflows/audit_check.yml; do
  if [ -e "$f" ]; then echo "  ✅ $f"; else echo "  ❌ $f 缺失"; MISSING_ASSETS=1; fi
done
for d in docs/superpowers/handoffs docs/superpowers/decisions .project; do
  if [ -d "$d" ]; then echo "  ✅ $d/"; else echo "  ❌ $d/ 缺失"; MISSING_ASSETS=1; fi
done
if [ -f AGENTS.md ] && grep -q "SOP-HOME" AGENTS.md 2>/dev/null; then
  echo "  ✅ AGENTS.md 桥接"
else
  echo "  ❌ AGENTS.md 桥接缺失（用 child-repo-guide.md §4 模板创建）"
  MISSING_ASSETS=1
fi
# .gitignore 冲突检测（Eclipse 规则忽略 .project 会静默断掉审计链）
if [ -f .gitignore ] && git check-ignore -q .project 2>/dev/null; then
  echo "  ⚠️ .project/ 被 .gitignore 忽略（Eclipse 规则冲突）——审计日志无法入库，钩子将持续失败"
  echo "     修复：在 .gitignore 中追加一行  !/.project/"
fi

echo ""
echo "[2/3] 工具链"
if command -v git >/dev/null 2>&1; then echo "  ✅ git"; else echo "  ❌ git 缺失"; MISSING_TOOLS=2; fi
if command -v node >/dev/null 2>&1; then echo "  ✅ Node.js"; else echo "  ❌ Node.js 缺失（lefthook 安装需要）: https://nodejs.org"; MISSING_TOOLS=2; fi
if command -v gh >/dev/null 2>&1; then
  echo "  ✅ GitHub CLI"
  if gh auth status >/dev/null 2>&1; then
    echo "  ✅ gh 已认证"
  else
    echo "  ❌ gh 未认证: 需 Driver 在终端手动执行 gh auth login（浏览器交互式，AI 不可代办）"
    MISSING_TOOLS=2
  fi
else
  echo "  ❌ GitHub CLI 缺失（Issue/PR 流程需要）: https://cli.github.com"
  MISSING_TOOLS=2
fi
if command -v python3 >/dev/null 2>&1; then
  echo "  ✅ python3（可选）"
else
  echo "  ⚠️ python3 缺失（可选，仅影响 context-guard 耗时统计）"
fi

echo ""
echo "[3/3] AI 端（无法自动检测，请 AI/开发者自查）"
echo "  ℹ️ Superpowers 技能由你的 AI CLI 插件提供，生命周期（brainstorming/"
echo "     writing-plans/TDD 等）依赖它。安装方式见母库 docs/superpowers/"
echo "     human-guide.md §6。未安装时 AI 会退化为纯文本流程，质量下降。"

echo ""
if [ "$MISSING_ASSETS" -eq 1 ] || [ "$MISSING_TOOLS" -ne 0 ]; then
  echo "❌ 未就绪：请按母库 docs/superpowers/child-repo-guide.md §3 完成接入后重试"
  echo "   （在完成接入前，禁止直接进入 brainstorming 等生命周期步骤）"
  if [ "$MISSING_ASSETS" -eq 1 ]; then exit 1; fi
  exit "$MISSING_TOOLS"
fi
echo "✅ 接入就绪：可按标准生命周期执行，运行时产物写入当前子库"
exit 0
