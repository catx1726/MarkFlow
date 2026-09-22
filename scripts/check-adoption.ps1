# Check Adoption — 子库接入前置自检 (PowerShell)
# 用法: .\scripts\check-adoption.ps1（在子库根目录运行，从母库路径调用）
# 返回: exit 0=就绪, 1=缺接入资产, 2=缺关键工具

$MISSING_ASSETS = 0
$MISSING_TOOLS = 0

Write-Host "============================================"
Write-Host "  子库接入自检 (Check Adoption)"
Write-Host "============================================"

Write-Host ""
Write-Host "[1/3] 接入资产（按母库 child-repo-guide.md §3 安装）"
foreach ($f in @('scripts/context-guard.sh', 'lefthook.yml', '.github/workflows/audit_check.yml')) {
    if (Test-Path $f) { Write-Host "  ✅ $f" } else { Write-Host "  ❌ $f 缺失"; $MISSING_ASSETS = 1 }
}
foreach ($d in @('docs/superpowers/handoffs', 'docs/superpowers/decisions', '.project')) {
    if (Test-Path $d) { Write-Host "  ✅ $d/" } else { Write-Host "  ❌ $d/ 缺失"; $MISSING_ASSETS = 1 }
}
if ((Test-Path AGENTS.md) -and (Select-String -Path AGENTS.md -Pattern 'SOP-HOME' -Quiet)) {
    Write-Host "  ✅ AGENTS.md 桥接"
} else {
    Write-Host "  ❌ AGENTS.md 桥接缺失（用 child-repo-guide.md §4 模板创建）"
    $MISSING_ASSETS = 1
}
# .gitignore 冲突检测（Eclipse 规则忽略 .project 会静默断掉审计链）
if (Test-Path .gitignore) {
    git check-ignore -q .project 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ⚠️ .project/ 被 .gitignore 忽略（Eclipse 规则冲突）——审计日志无法入库，钩子将持续失败"
        Write-Host "     修复：在 .gitignore 中追加一行  !/.project/"
    }
}

Write-Host ""
Write-Host "[2/3] 工具链"
if (Get-Command git -ErrorAction SilentlyContinue) { Write-Host "  ✅ git" } else { Write-Host "  ❌ git 缺失"; $MISSING_TOOLS = 2 }
if (Get-Command node -ErrorAction SilentlyContinue) { Write-Host "  ✅ Node.js" } else { Write-Host "  ❌ Node.js 缺失（lefthook 安装需要）: https://nodejs.org"; $MISSING_TOOLS = 2 }
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "  ✅ GitHub CLI"
    gh auth status 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ gh 已认证"
    } else {
        Write-Host "  ❌ gh 未认证: 需 Driver 在终端手动执行 gh auth login（浏览器交互式，AI 不可代办）"
        $MISSING_TOOLS = 2
    }
} else {
    Write-Host "  ❌ GitHub CLI 缺失（Issue/PR 流程需要）: https://cli.github.com"
    $MISSING_TOOLS = 2
}
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    Write-Host "  ✅ python3（可选）"
} else {
    Write-Host "  ⚠️ python3 缺失（可选，仅影响 context-guard 耗时统计）"
}

Write-Host ""
Write-Host "[3/3] AI 端（无法自动检测，请 AI/开发者自查）"
Write-Host "  ℹ️ Superpowers 技能由你的 AI CLI 插件提供，生命周期（brainstorming/"
Write-Host "     writing-plans/TDD 等）依赖它。安装方式见母库 docs/superpowers/"
Write-Host "     human-guide.md §6。未安装时 AI 会退化为纯文本流程，质量下降。"

Write-Host ""
if ($MISSING_ASSETS -eq 1 -or $MISSING_TOOLS -ne 0) {
    Write-Host "❌ 未就绪：请按母库 docs/superpowers/child-repo-guide.md §3 完成接入后重试"
    Write-Host "   （在完成接入前，禁止直接进入 brainstorming 等生命周期步骤）"
    if ($MISSING_ASSETS -eq 1) { exit 1 }
    exit $MISSING_TOOLS
}
Write-Host "✅ 接入就绪：可按标准生命周期执行，运行时产物写入当前子库"
exit 0
