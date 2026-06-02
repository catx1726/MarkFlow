# 手术切入式开发工作流 (Surgical Workflow)

## 1. 定位与上下文

本工作流是**标准生命周期的精简分支**，用于处理已有功能的轻量级变更。

标准生命周期（`docs/superpowers/lifecycle.md`）适用于全新功能开发和重大架构变更，
要求完整的 Spec → Issue → Plan → TDD → 三层验证 → Distill 闭环。

当变更范围小（≤10 文件）、目标明确、无架构变更、且为现有模块内部调整时，使用本工作流以减少文档负担和流程摩擦。

---

## 2. 快速判断（触发器）

AI 在接收任务后，**立即执行**以下判断：

```markdown
- [ ] 修改文件数 ≤ 10 个？
- [ ] 用户能描述"修改 X 使其在 Y 场景下输出 Z"？
- [ ] 不涉及接口/数据模型/依赖关系变更？
- [ ] 修改对象是已存在的功能（非全新模块）？
```

**结果：**

| 勾选数 | 结论 |
|--------|------|
| 4/4 ✅ | **使用 Surgical Workflow** — 跳过 Spec/Plan，直接进入逻辑 MRI |
| < 4 | **回退标准生命周期** — 执行 brainstorming → Spec → Issue → Plan |

**重要**：不满足条件时强行使用 Surgical Workflow 会导致方向偏差和返工。

---

## 3. 适用条件（详细说明）

| 条件 | 说明 |
|------|------|
| **范围有限** | 修改文件数 ≤ 10 个，且不含新增目录结构 |
| **目标明确** | 用户能描述"修改 X 使其在 Y 场景下输出 Z" |
| **无架构变更** | 不涉及接口契约变更、数据模型变更、依赖关系变更 |
| **已有代码基** | 修改对象必须是已存在的功能，而非全新模块 |

**不满足任一条件 → 切换回标准生命周期。**

---

## 4. 工作流阶段

```text
逻辑 MRI ──→ 安全垫 ──→ 极简计划 ──→ 增量开发 ──→ 验证与闭环
  (理解)      (锁定)       (规划)        (实施)        (确认)
```

### 阶段 1：逻辑 MRI (Logic MRI & Mapping)

**目标：** 在不通读全量代码的情况下，精准锁定逻辑位置与影响范围。

**动作：**

1. AI 接收用户提供的模糊入口点（函数名、关键字、类名、错误日志片段）。
2. 执行全量扫描：grep 定位定义 + 查找所有引用点。
3. 向上追溯调用链（谁调用了这个函数），向下追踪副作用（这个函数修改了什么状态）。

**输出（必须写入临时文件）：**

```markdown
## 逻辑简报
- **触发条件**：当 X 发生时
- **执行流程**：系统执行 Y，然后 Z
- **副作用**：写入数据库表 A，调用外部 API B
- **影响范围**：文件 M、N、P（共 3 个）

## 影响地图
| 层级 | 组件 | 关系 |
|------|------|------|
| 直接修改 | `src/auth.ts` | 目标文件 |
| 直接调用 | `src/api/login.ts` | 调用方 |
| 间接影响 | `tests/e2e/login.spec.ts` | 测试覆盖 |
```

**上下文管理检查：** 如果扫描涉及 >10 个文件，立即执行 **Offloading**
（将 MRI 输出写入 `docs/superpowers/analysis/<task-id>-mri.md`，会话中只保留链接）。

---

### 阶段 2：建立安全垫 (Safety Net)

**目标：** 锁定现状，防止修补 A 时意外破坏 B。

**动作：**

1. 判断现有测试覆盖度：
   - 如果已有单元测试覆盖修改点 → 运行现有测试，记录基线结果。
   - 如果没有测试覆盖 → 编写**特征测试 (Characterization Tests)**。

**特征测试编写规范：**

```typescript
// 原则：不关注"正确性"，只记录"当前实际输出"
describe('Characterization: auth module', () => {
  it('records current behavior for login with valid credentials', () => {
    const result = login('test@example.com', 'password123');
    // 使用快照或硬编码记录当前输出
    expect(result).toEqual({
      token: 'eyJhbGciOiJIUzI1NiIs...', // 当前实际输出
      expiresIn: 3600
    });
  });
});
```

**注意：** 特征测试在 Surgical Workflow 中允许**不清理**——它们只在本次任务中作为安全垫，任务完成后由用户决定是否保留。

---

### 阶段 3：Surgical Plan（极简计划）

**目标：** 跳过 Spec 文档，生成仅关注改动差异的可执行计划。

**动作：**

1. 在 `writing-plans` 技能引导下，基于 MRI 输出生成计划。
2. 计划格式：

```markdown
## Surgical Plan

### 改动点 1
- **位置**：`src/auth.ts:45-52`
- **当前逻辑**：...
- **目标逻辑**：...
- **验证**：运行 `npm test -- auth.test.ts`

### 改动点 2
- **位置**：`src/auth.ts:78`
- **当前逻辑**：...
- **目标逻辑**：...
- **验证**：运行特征测试确认无退化
```

**约束：**

- 计划 ≤ 10 个步骤
- 每个步骤必须包含**精确的文件路径和行号范围**
- 每个步骤必须包含**验证命令**
- 不含背景描述（背景在 MRI 输出中）

---

### 阶段 4：增量开发与验证

**目标：** 实施改动并验证。

**动作：**

1. 按 Surgical Plan 逐步执行。
2. 每完成一个改动点 → 运行对应的验证命令。
3. 所有改动完成后 → 运行完整测试套件（特征测试 + 新 TDD 测试）。

**验证层级（适配三层验证架构）：**

| 层级 | 检查项 | 执行者 |
|------|--------|--------|
| **Layer 1** | lefthook 通过（markdownlint、docs-structure、conventional-commit） | 自动化 |
| **Layer 2** | 特征测试无退化 + 新 TDD 测试通过 + 构建命令 exit 0 | Generator 自身 |
| **Layer 3** | **可选**。如果改动涉及用户可见行为（UI/API 响应），触发 `meta-runtime-evaluator` | 独立 Evaluator |

**合规检查（精简版）：**

Surgical Workflow 不要求完整的 `meta-compliance-checker` checklist，
但必须勾选以下**阻断项 (BLOCKING)**：

```markdown
- [ ] 用户输入校验（如果修改涉及输入处理）
- [ ] 无敏感信息硬编码（检查修改的代码中无 password/secret/token/key）
- [ ] 特征测试或现有测试通过
```

---

### 阶段 5：闭环

**目标：** 完成最小化闭环，记录关键决策。

**动作：**

1. **Git 提交**：使用 Conventional Commits（`fix:` 或 `refactor:`）。
2. **审计日志**：在 `.project/ops_changelog.md` 追加记录（遵循写保护协议）。
3. **决策留档**（如适用）：如果本次改动识别出了可复用模式或重要陷阱，
   按 `context-management-strategy.md` 的中间决策留档机制追加到当前任务 handoff。
4. **清理**：删除临时 MRI 文件（除非用户要求保留）。

**不执行的步骤：**

- ❌ 创建 Spec 文档
- ❌ 创建 Issue（除非 Bug 需要跟踪）
- ❌ 创建完整 Plan 文档
- ❌ `meta-distiller` 资产提纯（范围太小，无资产可提）

---

## 5. 与标准生命周期的衔接

```text
标准生命周期 (lifecycle.md)
├── Launch: brainstorming → Spec → Issue → Branch
├── Plan & Act: writing-plans → executing-plans → meta-safe-executor
├── Test & Verify: TDD → 三层验证
├── Distill & Close: meta-distiller → PR → Merge
│
└── 【分支】Surgical Workflow（本工作流）
    ├── 逻辑 MRI（替代 brainstorming + Spec）
    ├── 安全垫（替代 TDD 的基线建立）
    ├── Surgical Plan（替代 writing-plans）
    ├── 增量开发 + 精简验证（替代完整三层验证）
    └── 最小闭环（跳过 meta-distiller）
```

**切换规则：**

| 场景 | 使用工作流 |
|------|-----------|
| 全新功能 / 架构变更 / >10 文件 | 标准生命周期 |
| Bug 修复 / 逻辑微调 / 无架构变更重构 / ≤10 文件 | Surgical Workflow |
| 执行过程中发现范围膨胀（>10 文件或架构变更） | **立即切换回标准生命周期**，补 Spec/Plan |

---

## 6. 上下文管理

Surgical Workflow 虽然短，但仍需上下文管理：

| 时机 | 动作 |
|------|------|
| MRI 阶段涉及 >10 个文件 | Offloading：将 MRI 输出写入文件 |
| 执行时间 >30 分钟 | Compaction：精简 todo，归档已完成分析 |
| 执行时间 >60 分钟 | Reset：生成 handoff，新建会话接续 |
| 用户提出范围变更 | 中间决策留档：记录变更和影响 |

---

## 7. Red Flags

- ❌ 用 Surgical Workflow 做全新功能开发（缺少 Spec 导致方向偏差）
- ❌ 跳过特征测试直接修改代码（无安全垫，易引入退化）
- ❌ 改动点 >10 个仍不切换回标准生命周期
- ❌ 未通过 Layer 1（lefthook）就提交
- ❌ 涉及安全相关修改但未勾选 BLOCKING checklist
