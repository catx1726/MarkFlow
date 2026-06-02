# Check docs structure compliance
# Enforces naming conventions, required front matter, and directory structure.

$ErrorCount = 0

# 1. Check handoff files have required front matter
Write-Host "🔍 Checking handoff files..."
$handoffs = Get-ChildItem -Path "docs/superpowers/handoffs" -Filter "*.md" -ErrorAction SilentlyContinue
foreach ($f in $handoffs) {
    $content = Get-Content -Path $f.FullName -Raw
    if ($content -notmatch "^handoff_id:") {
        Write-Host "  ❌ $($f.Name): missing 'handoff_id' in front matter"
        $ErrorCount++
    }
    if ($content -notmatch "^---") {
        Write-Host "  ❌ $($f.Name): missing front matter delimiters"
        $ErrorCount++
    }
}

# 2. Check skill files have required front matter
Write-Host "🔍 Checking skill files..."
$skills = Get-ChildItem -Path "skills" -Recurse -Filter "SKILL.md" -ErrorAction SilentlyContinue
foreach ($f in $skills) {
    $content = Get-Content -Path $f.FullName -Raw
    if ($content -notmatch "^name:") {
        Write-Host "  ❌ $($f.FullName): missing 'name' in front matter"
        $ErrorCount++
    }
    if ($content -notmatch "^description:") {
        Write-Host "  ❌ $($f.FullName): missing 'description' in front matter"
        $ErrorCount++
    }
}

# 3. Check docs/superpowers/ files have consistent naming
Write-Host "🔍 Checking docs/superpowers/ naming..."
$docs = Get-ChildItem -Path "docs/superpowers" -Filter "*.md" -ErrorAction SilentlyContinue
foreach ($f in $docs) {
    if ($f.Name -notmatch "^[a-z0-9-]+\.md$") {
        Write-Host "  ❌ $($f.Name): filename should be lowercase with hyphens only"
        $ErrorCount++
    }
}

if ($ErrorCount -eq 0) {
    Write-Host "✅ Docs structure check passed"
    exit 0
} else {
    Write-Host "❌ Docs structure check failed: $ErrorCount error(s)"
    exit 1
}
