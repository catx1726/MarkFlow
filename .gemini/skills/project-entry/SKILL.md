---
name: project-entry
description: Use when starting any task in this repository. Establishes how to discover and invoke skills from the skills/ directory.
---

# Project Entry (Skill System Bootstrap)

## The Rule

**If a skill from this project's `skills/` directory applies to your task, YOU MUST USE IT.**

This is not optional. Check for matching skills **before** responding or taking action.

## Available Skills

| Skill | Path | When to Use |
|-------|------|-------------|
| meta-safe-executor | `skills/meta/meta-safe-executor/SKILL.md` | Before any write operation (CREATE/UPDATE/DELETE/MOVE) |
| meta-compliance-checker | `skills/custom/meta-compliance-checker/SKILL.md` | Before claiming task completion |
| meta-runtime-evaluator | `skills/meta/meta-runtime-evaluator/SKILL.md` | After Layer 2 verification passes, for runtime behavior evaluation |
| meta-distiller | `skills/meta/meta-distiller/SKILL.md` | When distilling logic to reusable assets |
| meta-rollback | `skills/meta/meta-rollback/SKILL.md` | When needing to undo recent operations |
| meta-step-runner | `skills/meta/meta-step-runner/SKILL.md` | When executing a skill marked `mode: step-by-step` |
| meta-path-discovery | `skills/meta/meta-path-discovery/SKILL.md` | When locating the project root directory or verifying working directory |

## How to Access Skills

**Platform Adaptation:**

- **Kimi Code CLI**: Use `ReadFile` to read the SKILL.md, then follow its instructions.
- **Claude Code**: Use the `Skill` tool if available; otherwise use `ReadFile`.
- **Gemini CLI**: Use `activate_skill` with the skill name; or `ReadFile` as fallback.
- **Copilot CLI**: Use the `skill` tool if available; otherwise `ReadFile`.
- **Other environments**: Read the SKILL.md file directly and follow its instructions.

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "I can check files quickly" | Files lack skill context. Check for skills first. |
| "I remember this skill" | Skills evolve. Read the current version. |
| "This doesn't need a formal skill" | If a skill exists, use it. |

## Instruction Priority

1. User's explicit instructions (AGENTS.md, direct requests) — highest priority
2. Skills from `skills/` directory — override default behavior where they conflict
3. Default system prompt — lowest priority
