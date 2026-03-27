---
name: openspec-archive-change
description: Archive a completed change in the experimental workflow.
mode: step-by-step
---

# OpenSpec Archive Change

## Overview
This skill guides the archiving of a completed Change directory. It ensures that the workspace remains clean and that the change is moved to the historical archive location.

## Implementation Workflow (Step-by-Step)

### 1. Preparation
- [ ] **Status Check**: Run `openspec status --json` to ensure all required artifacts are `done`.
- [ ] **Task Verification**: Confirm all checkboxes in `tasks.md` are marked complete.

### 2. Physical Migration
- [ ] **Archive Directory**: Create `openspec/changes/archive/` if it doesn't exist.
- [ ] **Relocation**: Execute the `mv` command to move the change folder to the archive, typically using the `YYYY-MM-DD-name` naming convention.

### 3. Verification
- [ ] **Cleanup Check**: Confirm the original directory in `openspec/changes/` has been successfully removed.

## Red Flags
- Archiving a change with pending tasks.
- Overwriting an existing archive directory without checking.
