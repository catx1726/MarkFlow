---
evaluator_input:
  task_id: "issue-N"
  task_description: "简要描述任务目标"
  plan_reference: "docs/superpowers/plans/issue-N.md"
  spec_reference: "docs/superpowers/specs/issue-N.md"
  generator_claims:
    - "声明 1"
    - "声明 2"
  layer2_results:
    command: "npm test"
    exit_code: 0
    summary: "X/Y pass, coverage Z%"
  changed_files:
    - path: "src/example.ts"
      description: "变更说明"
  verification_commands:
    - "npm run dev"
    - "npm run test:e2e"
  sprint_contract:
    - "验收标准 1"
    - "验收标准 2"
---

## 补充上下文

<!-- Generator 在此处补充 Evaluator 需要但 handoff 中未包含的信息 -->
