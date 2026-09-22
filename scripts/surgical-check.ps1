# Surgical Workflow Check — 工作流选择辅助判断器 (PowerShell)
# 用法: .\scripts\surgical-check.ps1 "<用户任务描述>"
# 注意: 本脚本为辅助参考，AI 应结合实际情况做最终决策

$INPUT = $args[0]
$LOWER_INPUT = ""
if ($INPUT) { $LOWER_INPUT = $INPUT.ToLower() }

# 1. 范围预估（基于关键词）
$SMALL_KEYWORDS = @("fix","bug","typo","css","style","rename","move","delete","remove","update","adjust","tweak","patch","hotfix","lint","format","comment","doc","log","error","warn","console","spelling","grammar","alignment","spacing","indent","color","font","size","width","height","margin","padding","align","position","display","overflow","z-index","background","border","shadow","opacity","transform","transition","animation")
$LARGE_KEYWORDS = @("feature","implement","add.*new","create.*new","build.*new","design","architecture","refactor","migrate","upgrade","redesign","restructure","introduce","integrate","framework","library","module","system","platform","service","component","plugin","extension","tool","utility","helper","manager","controller","handler","middleware","repository","dao","dto","vo","entity","model","domain","aggregate","event","command","query","saga","workflow","pipeline")
$ARCH_KEYWORDS = @("database","schema","table","column","index","migration","foreign key","primary key","api","endpoint","route","middleware","dependency","package","config","environment","env","variable","secret","token","key","certificate","ssl","tls","oauth","jwt","auth","permission","role","policy","gateway","proxy","cache","redis","message queue","kafka","rabbitmq","event bus","websocket","grpc","graphql","rest","openapi","swagger","protobuf","json schema","docker","kubernetes","k8s","helm","terraform","cloud","aws","azure","gcp","serverless","lambda","ci/cd","pipeline","github action","jenkins","gitlab")
$SPECIFIC_KEYWORDS = @("file","function","class","method","component","page","route","api","endpoint","variable","constant","config","setting","button","form","modal","table","list","header","footer","sidebar","nav","menu","tab","card","chart","graph","image","icon","error","exception","crash","fail","timeout","slow","memory","leak","should","must","need to","expected","want to","would like","please make","please fix","please add","please remove","please update","please change","please adjust","please modify","please rename","please move","please delete")

function Count-Matches($text, $patterns) {
    $count = 0
    foreach ($p in $patterns) {
        $matches = [regex]::Matches($text, $p)
        $count += $matches.Count
    }
    return $count
}

$SMALL_SCORE = 0
$LARGE_SCORE = 0
$ARCH_SCORE = 0
$SPECIFIC_SCORE = 0

if ($LOWER_INPUT) {
    $SMALL_SCORE = Count-Matches $LOWER_INPUT $SMALL_KEYWORDS
    $LARGE_SCORE = Count-Matches $LOWER_INPUT $LARGE_KEYWORDS
    $ARCH_SCORE = Count-Matches $LOWER_INPUT $ARCH_KEYWORDS
    $SPECIFIC_SCORE = Count-Matches $LOWER_INPUT $SPECIFIC_KEYWORDS
}

# 2. 决策逻辑
$SUGGESTION = "STANDARD"
$REASON = ""

if (-not $INPUT) {
    $SUGGESTION = "STANDARD"
    $REASON = "未提供任务描述，无法判断范围。为降低风险，建议标准生命周期。"
} elseif ($ARCH_SCORE -ge 2) {
    $SUGGESTION = "STANDARD"
    $REASON = "检测到架构/数据模型相关关键词（$ARCH_SCORE 个），建议标准生命周期以确保充分规划。"
} elseif ($LARGE_SCORE -ge 2 -and $SMALL_SCORE -le 1) {
    $SUGGESTION = "STANDARD"
    $REASON = "检测到大型变更关键词（$LARGE_SCORE 个），且无明显小型修复特征。"
} elseif ($SMALL_SCORE -ge 1 -and $LARGE_SCORE -eq 0 -and $ARCH_SCORE -eq 0) {
    $SUGGESTION = "SURGICAL"
    $REASON = "检测到小型修复/调整关键词（$SMALL_SCORE 个），无架构变更风险。"
} elseif ($SPECIFIC_SCORE -ge 3 -and $ARCH_SCORE -eq 0 -and $LARGE_SCORE -eq 0) {
    $SUGGESTION = "SURGICAL"
    $REASON = "目标描述较明确（$SPECIFIC_SCORE 个具体指标），且无架构变更风险。"
} else {
    $SUGGESTION = "STANDARD"
    $REASON = "无法明确判定为小型修复。为降低风险，建议标准生命周期。"
}

# 3. 输出仪表盘
Write-Host "╔══════════════════════════════════════════╗"
Write-Host "║     Surgical Workflow Check              ║"
Write-Host "╠══════════════════════════════════════════╣"
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Suggestion", $SUGGESTION)
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Small Signals", $SMALL_SCORE)
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Large Signals", $LARGE_SCORE)
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Specific Signals", $SPECIFIC_SCORE)
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Arch Risk", $ARCH_SCORE)
Write-Host "╠══════════════════════════════════════════╣"
Write-Host ("║  {0,-20} : {1,-16} ║" -f "Reason", $REASON.Substring(0, [Math]::Min(30, $REASON.Length)))
Write-Host "╚══════════════════════════════════════════╝"
Write-Host ""
Write-Host "⚠️ 注意：本脚本为辅助判断。AI 应结合以下因素做最终决策："
Write-Host "   - 预估修改文件数是否 ≤10"
Write-Host "   - 是否涉及接口/数据模型/依赖关系变更"
Write-Host "   - 修改对象是否为已存在的功能"
Write-Host "   - 若存在 handoff 文件或跨任务依赖，仍建议 STANDARD"
