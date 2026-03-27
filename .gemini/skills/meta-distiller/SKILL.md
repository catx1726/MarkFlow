---
name: meta-distiller
description: Use when distilling logic from business code to Mother-Base with Staging approval and Skill-Pattern linkage.
mode: step-by-step
---

# Meta Distiller (Logic & Knowledge Refinement)

## Overview
本技能是 SOP 2.0 体系的“提纯专家”。它负责将业务代码中的碎片逻辑转化为标准的物理图纸（Pattern）与智力资产（Skill），并通过“暂存区（Staging）”机制确保母库的受控演进。

## Boundaries
- **不处理 UI 组件**：仅提取纯逻辑、算法、Hooks 或数据协议。严禁收割带有 CSS 或具体 JSX 结构的视图代码。
- **非自动化迁移**：本技能仅负责“提纯”至暂存区，最终入库需在 Archive 阶段由用户二次确认。
- **环境隔离**：收割的资产必须在 `{{RUNTIME_VERSION}}` 环境下可独立运行，不得依赖子库特有的全局变量。

## The Stance
执行本技能时，AI 必须切换为 **「冷酷的逻辑审计员」** 姿态：
- **挑剔**：像洁癖一样寻找硬编码的业务变量（如项目名、API 域名）。
- **怀疑**：质疑逻辑的通用性——“如果我把这段代码放到另一个完全不同的项目中，它还能工作吗？”。
- **严谨**：不满足于代码迁移，必须同时思考这背后的“方法论”并将其转化为 Skill 指令。

## When to Use
- 在任务归档前执行“资产提纯”。
- 将子库中的通用模块反哺给母库。
- 建立“方法论（Skill）”与“实现（Pattern）”的闭环。

## Core Pattern: Controlled Evolution
1. **Staging Approval**: 所有提纯资产优先写入子库 `.gemini/distill_stage/`，禁止直接跨库写入母库。
2. **Skill-Pattern Linkage**: 
   - **Skill (common-xxx.md)**: 定义“为什么用”、“何时用”，并包含指向 Pattern 的 Markdown 链接。
   - **Pattern (patterns/xxx/)**: 提供 index 三件套（代码、测试、说明）。
3. **Automatic Distillation**: 依据 `env.md` 的词库自动执行正则参数化（`{{VAR}}`）。

## Implementation Workflow (Step-by-Step)

### 1. Preparation & Detection (Heuristic Core Discovery)
- [ ] **自动嗅探逻辑核心**：
  - **Dependency Scan**: 扫描当前任务修改的文件，自动统计非第三方库的 `import` 引用频次。引用次数 ≥ 2 且不含 `business`, `user_profile` 等业务敏感词的文件自动标记为“提纯候选项”。
  - **Exports Mapping**: 自动读取 `package.json` 的 `exports` 字段或 `src/index.ts`。导出的纯函数、接口定义（Schema）优先进入提纯流程。
- [ ] **扫描母库查重**：在 `{{FOUNDRY_ROOT}}/patterns/` 下搜索类似功能，避免重复收割。
- [ ] **提取 IPO 模型**：基于识别出的核心文件，识别 Input（输入参数）、Process（计算逻辑/算法）、Output（返回结构），并记录在当前会话。

### 2. Staging Construction (Sub-Project Local)
- **建立暂存结构**：在当前 Workshop 创建 `.gemini/distill_stage/patterns/<name>/`。
- [ ] **执行参数化提取**：将代码中的业务变量替换为 `{{VAR}}`，写入逻辑主文件。
- [ ] **生成测试规格**：编写符合 `{{RUNTIME_VERSION}}` 标准的测试文件。

- [ ] **编写资产说明**：生成 `README.md`，明确契约与安装依赖。

### 3. Knowledge Distillation & Reflection
- [ ] **生成 Skill 初稿**：在 `.gemini/distill_stage/skills/` 生成 `common-<name>.md`。
- [ ] **自动生成任务总结 (Reflection)**：基于 SOP1 的总结模型，自动生成包含元数据的 Markdown 总结：
  - **Metadata**: 自动填充 `task_id`, `type`, `affected_files`。
  - **Knowledge Points**: 总结本次任务中涉及的架构决策与防御式编程实现。
  - **Lessons Learned**: 记录本项目中容易被忽略的细节（如：路由同步是否完成）。
- [ ] **注入引用硬链接**：在 Skill 文档中链接至母库预期的物理路径。

### 4. Local Verification (Pre-verify)
- [ ] **运行环境自检**：确认当前 Workshop 的 `env.md` 中定义了 `{{TEST_COMMAND}}`。
- [ ] **执行验证测试**：在子库环境下执行 `{{TEST_COMMAND}}`。**强制要求**：测试必须 100% 通过方可继续，严禁携带失败的测试提交 Staging。

### 5. Integration (Foundry Re-verify & Accept)
- [ ] **入库考试**：在 Accept 阶段，AI 物理迁移资产后必须执行复合校验：
  1. 切换至母库环境。
  2. 执行 `{{TEST_COMMAND}} patterns/<name>/index.test.ts`。
- [ ] **原子撤回**：若母库复验失败，AI 必须自动清理母库端残留，并将资产状态回滚至子库 Staging 区，提示用户修正环境差异。
- [ ] **最终确认**：复验通过后，准备 Accept 指令并更新母库索引。

## Patterns & Anti-Patterns

### ✅ Pattern: 原子化参数化
**Before (业务代码)**:
```typescript
const fetchUser = (id: string) => fetch(`https://api.huasheng.com/v1/users/${id}`);
```
**After (提纯后的 index.ts)**:
```typescript
/**
 * 提取自 {{PROJECT_NAME}}
 * @param apiBase - 环境指定的 API 根路径
 */
export const fetchUserLogic = (apiBase: string, id: string) => fetch(`${apiBase}/users/${id}`);
```
*理由：彻底移除了私有域名，改为由调用方注入参数。*

### ❌ Anti-Pattern: 伪提纯
**错误做法**: 直接拷贝整个业务文件，仅在 README 里写了一句“请修改变量后使用”。
*后果：AI 在复用时会带入大量的残留业务逻辑，导致代码污染和运行报错。*

### ✅ Pattern: 联动 Skill
**common-fetch-user.md**:
> Use when you need to retrieve user profile data from a REST API.
> **Implementation**: [Logic]({{FOUNDRY_ROOT}}/patterns/user-fetcher/index.ts)

## Common Mistakes
- **逻辑重复**：未检查母库是否已有同类 Pattern。
- **硬编码路径**：在 Skill 文档中使用相对于当前子库的相对路径。*修正：必须使用相对于母库根目录的变量或绝对路径。*
- **忽略 Skill 提纯**：只收割代码不总结经验。

## Final Audit (Self-Checklist)
在完成提纯并准备提交 Staging 前，AI 必须自检以下 5 项：
1. **纯净度**：搜索 `index.ts` 是否仍含有子库 `env.md` 中标注的私有业务变量。
2. **闭环性**：`index.test.ts` 是否覆盖了主要的逻辑分支？
3. **可链接性**：`common-xxx.md` 中的 `Implementation` 链接是否指向了母库的预期物理路径？
4. **触发精确度**：`Use when...` 描述是否包含至少 3 个高频业务关键词？
5. **依赖透明度**：`README.md` 是否列出了运行此代码所需的全部 npm 依赖？

## Red Flags
- 提纯资产中保留了未经参数化的业务关键词。
- Skill 文档缺少 `Use when...` 触发描述。
- 暂存区缺少 Vitest 测试用例。
