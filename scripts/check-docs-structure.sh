#!/bin/bash
# Check docs structure compliance
# Enforces naming conventions, required front matter, and directory structure.

set -euo pipefail

ERRORS=0

# 1. Check handoff files have required front matter
echo "🔍 Checking handoff files..."
for f in docs/superpowers/handoffs/*.md; do
  [ -f "$f" ] || continue
  if ! grep -q "^handoff_id:" "$f"; then
    echo "  ❌ $f: missing 'handoff_id' in front matter"
    ((ERRORS++))
  fi
  if ! grep -q "^---" "$f"; then
    echo "  ❌ $f: missing front matter delimiters"
    ((ERRORS++))
  fi
done

# 2. Check skill files have required front matter
echo "🔍 Checking skill files..."
for f in skills/*/*/SKILL.md; do
  [ -f "$f" ] || continue
  if ! grep -q "^name:" "$f"; then
    echo "  ❌ $f: missing 'name' in front matter"
    ((ERRORS++))
  fi
  if ! grep -q "^description:" "$f"; then
    echo "  ❌ $f: missing 'description' in front matter"
    ((ERRORS++))
  fi
done

# 3. Check docs/superpowers/ files have consistent naming
echo "🔍 Checking docs/superpowers/ naming..."
for f in docs/superpowers/*.md; do
  [ -f "$f" ] || continue
  basename=$(basename "$f")
  # Allow: lowercase, hyphens, .md extension
  if [[ ! "$basename" =~ ^[a-z0-9-]+\.md$ ]]; then
    echo "  ❌ $f: filename should be lowercase with hyphens only"
    ((ERRORS++))
  fi
done

if [ "$ERRORS" -eq 0 ]; then
  echo "✅ Docs structure check passed"
  exit 0
else
  echo "❌ Docs structure check failed: $ERRORS error(s)"
  exit 1
fi
