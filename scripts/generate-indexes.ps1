# Generate Indexes — 自动生成 handoffs/ 和 decisions/ 的 INDEX.md (PowerShell)
# 用法: .\scripts\generate-indexes.ps1

function Generate-HandoffIndex {
    $DIR = "docs/superpowers/handoffs"
    $INDEX = "$DIR/INDEX.md"
    
    if (-not (Test-Path $DIR)) {
        Write-Host "⚠️ 目录不存在: $DIR"
        return
    }
    
    $FILES = Get-ChildItem "$DIR/*.md" -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne "INDEX.md" } | Sort-Object Name -Descending | Select-Object -First 20
    
    if (-not $FILES) {
        "<!-- 暂无 handoff 文件 -->" | Set-Content $INDEX -Encoding UTF8
        Write-Host "✅ Handoff 索引已清空（无文件）。"
        return
    }
    
    $CONTENT = @"# Handoff 索引

> 按时间倒序排列，最新在前。AI 在接续任务时优先阅读最上方的 handoff。

| 文件 | 任务ID | 状态 | 时间 | 摘要 |
|------|--------|------|------|------|
"@
    
    foreach ($f in $FILES) {
        $BASENAME = $f.Name
        # 从文件名提取 task-id
        if ($BASENAME -match '^([A-Za-z0-9_-]+)-(\d{8})-(\d{6})\.md$') {
            $TASK_ID = $Matches[1]
            $DATE_RAW = "$($Matches[2])-$($Matches[3])"
            $FORMATTED_DATE = "$($Matches[2].Substring(0,4))-$($Matches[2].Substring(4,2))-$($Matches[2].Substring(6,2)) $($Matches[3].Substring(0,2)):$($Matches[3].Substring(2,2))"
        } else {
            $TASK_ID = "—"
            $FORMATTED_DATE = "—"
        }
        
        $STATUS = "unknown"
        $SUMMARY = "—"
        
        $FILE_CONTENT = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
        if ($FILE_CONTENT) {
            $STATUS_MATCH = [regex]::Match($FILE_CONTENT, '(?m)^status:\s*(\S+)')
            if ($STATUS_MATCH.Success) { $STATUS = $STATUS_MATCH.Groups[1].Value }
            
            # 提取任务目标
            $GOAL_MATCH = [regex]::Match($FILE_CONTENT, '(?ms)## 任务目标.*?\n(?!## )([^
<!--].*?)\n')
            if ($GOAL_MATCH.Success) {
                $SUMMARY = $GOAL_MATCH.Groups[1].Value.Trim()
                if ($SUMMARY.Length -gt 40) { $SUMMARY = $SUMMARY.Substring(0, 40) + "..." }
            }
        }
        
        $CONTENT += "| [``$BASENAME``]($BASENAME) | $TASK_ID | $STATUS | $FORMATTED_DATE | $SUMMARY |`n"
    }
    
    $CONTENT | Set-Content $INDEX -Encoding UTF8
    Write-Host "✅ Handoff 索引已更新: $INDEX"
}

function Generate-DecisionIndex {
    $DIR = "docs/superpowers/decisions"
    $INDEX = "$DIR/INDEX.md"
    
    if (-not (Test-Path $DIR)) {
        Write-Host "⚠️ 目录不存在: $DIR"
        return
    }
    
    $FILES = Get-ChildItem "$DIR/*.md" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 20
    
    if (-not $FILES) {
        "<!-- 暂无决策归档文件 -->" | Set-Content $INDEX -Encoding UTF8
        Write-Host "✅ Decision 索引已清空（无文件）。"
        return
    }
    
    $CONTENT = @"# Decision 索引

> 按时间倒序排列，最新在前。

| 文件 | 日期 | 标题 | 影响 |
|------|------|------|------|
"@
    
    foreach ($f in $FILES) {
        $BASENAME = $f.Name
        if ($BASENAME -match '^([0-9]{4}-[0-9]{2}-[0-9]{2})-(.+)\.md$') {
            $DATE = $Matches[1]
            $TITLE = ($Matches[2] -replace '-', ' ')
            # 首字母大写
            $TITLE = (Get-Culture).TextInfo.ToTitleCase($TITLE)
        } else {
            $DATE = "—"
            $TITLE = $BASENAME
        }
        
        $IMPACT = "—"
        $FILE_CONTENT = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
        if ($FILE_CONTENT) {
            $IMPACT_MATCH = [regex]::Match($FILE_CONTENT, '(?m)^\*\*影响\*\*\s*\n?(.*)')
            if ($IMPACT_MATCH.Success) {
                $IMPACT = $IMPACT_MATCH.Groups[1].Value.Trim()
                if ($IMPACT.Length -gt 40) { $IMPACT = $IMPACT.Substring(0, 40) + "..." }
            }
        }
        
        $CONTENT += "| [``$BASENAME``]($BASENAME) | $DATE | $TITLE | $IMPACT |`n"
    }
    
    $CONTENT | Set-Content $INDEX -Encoding UTF8
    Write-Host "✅ Decision 索引已更新: $INDEX"
}

Generate-HandoffIndex
Generate-DecisionIndex
