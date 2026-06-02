#!/bin/bash
# Sync skills from platform-agnostic directory to platform-specific directories.
# Skills are organized under skills/<category>/ but flattened at the target.
#
# Usage:
#   ./scripts/sync-skills.sh                    # sync to default target (.gemini/skills)
#   ./scripts/sync-skills.sh --target .claude/skills
#   ./scripts/sync-skills.sh --target .gemini/skills --target .claude/skills
#
# Supported targets by platform:
#   Gemini CLI  → .gemini/skills
#   Claude Code → .claude/skills
#   Cursor      → .cursor/skills

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_DIR="${PROJECT_ROOT}/skills"

# Parse arguments
TARGETS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGETS+=("$2")
      shift 2
      ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "❌ Unknown option: $1"
      echo "Use --help for usage."
      exit 1
      ;;
  esac
done

# Default target for backward compatibility
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  TARGETS=(".gemini/skills")
fi

echo "🔄 Syncing skills from ${SOURCE_DIR}..."

for target_rel in "${TARGETS[@]}"; do
  target="${PROJECT_ROOT}/${target_rel}"
  parent="$(dirname "$target")"

  if [ -d "$parent" ]; then
    mkdir -p "$target"
    # Flatten: copy contents from all subdirectories in skills/
    for category_dir in "${SOURCE_DIR}"/*/; do
      if [ -d "$category_dir" ] && [ -n "$(ls -A "$category_dir" 2>/dev/null)" ]; then
        cp -r "${category_dir}"* "${target}/"
      fi
    done
    echo "✅ Synced to ${target_rel}"
  else
    echo "⏭️  Skipped ${target_rel} (parent directory does not exist)"
  fi
done

echo "🎉 Skills sync complete."
