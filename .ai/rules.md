# AI 协作与工程强规则

## 1. 代码风格 (Style Guide)

- **Prettier 配置**：必须遵循项目根目录 `.prettierrc`（或你代码块中定义的单引号、无分号、120 字符等）。
- **语义化**：禁止使用 `data1`, `temp`, `handle` 等模糊命名。变量名必须体现其物理意义（如 `isUserAuthenticated`）。

## 2. 架构约束 (Architecture)

- **引用隔离 (Immutability)**：在 Vue 2/3 处理对象或数组赋值时，必须使用 `{...obj}` 或 `JSON.parse(JSON.stringify())` 确保响应式引用的物理隔离。
- **Prop 单向数据流**：严禁直接在子组件修改 Prop。必须通过事件派发（$emit）通知父组件更新。

## 3. 健壮性与 TDD (Robustness)

- **接口先行**：在编写任何具体函数逻辑前，必须先以注释或 Typescript Interface 形式输出输入参数和返回值的定义。
- **防御式编程**：
  - 所有 API 调用必须包裹 `try...catch`。
  - **状态闭环**：在 Catch 块中，必须显式恢复 Loading 状态或重置关键变量，防止 UI 挂起。
  - **空值检查**：对深层对象属性访问（如 `a.b.c`）必须使用可选链或前置判空。

## 4. AI 归档规范 (SOP Compliance)

- **同步要求**：代码逻辑发生重大变更后，必须同步更新 `.ai/archive/` 下对应的 MD 文档。
- **自检检查清单**：每次输出代码前，请对照本规则检查是否违反了“引用隔离”和“状态闭环”原则。
