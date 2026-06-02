# Clean Code 快速参考

> 本文件是对 `code-standards/README.md`（clean-code-javascript submodule）的**精华提取**。详细内容和完整示例请查阅原 submodule。

---

## 1. 变量 (Variables)

### 使用有意义且可发音的名称

```javascript
// ❌ 不知道 d 是什么
const d = new Date();

// ✅ 清晰可读
const currentDate = new Date();
```

### 避免魔法数字/字符串

```javascript
// ❌ 300 是什么？
setTimeout(retry, 300);

// ✅ 命名常量
const RETRY_DELAY_MS = 300;
setTimeout(retry, RETRY_DELAY_MS);
```

### 使用常量而非 var/let（如果不需要重新赋值）

```javascript
// ❌ let 暗示可能修改
let taxRate = 0.2;

// ✅ const 明确表示不变
const TAX_RATE = 0.2;
```

---

## 2. 函数 (Functions)

### 函数只做一件事（单一职责）

```javascript
// ❌ 做了两件事：获取邮件 + 发送邮件
function emailClients(clients) {
  clients.forEach(client => {
    const record = database.lookup(client);
    sendEmail(client, record);
  });
}

// ✅ 拆分为两个函数
function getClientRecord(client) {
  return database.lookup(client);
}

function emailClients(clients) {
  clients.forEach(client => {
    const record = getClientRecord(client);
    sendEmail(client, record);
  });
}
```

### 函数参数 ≤ 2 个（理想情况）

```javascript
// ❌ 参数过多，调用时不清楚顺序
function createMenu(title, body, buttonText, cancellable) { }

// ✅ 使用对象参数（具名传参）
function createMenu({ title, body, buttonText, cancellable }) { }
createMenu({ title: 'Foo', body: 'Bar', buttonText: 'Baz', cancellable: true });
```

### 函数名应说明其动作

```javascript
// ❌ 名字像查询，实际有副作用
function getUser() {
  user = database.query();  // 副作用：修改了外部变量
  return user;
}

// ✅ 名字反映副作用
function loadUser() {
  user = database.query();
  return user;
}
```

---

## 3. 条件与流程控制 (Conditionals)

### 避免深层嵌套（提前返回）

```javascript
// ❌ 深层嵌套，难以阅读
function isUserEligible(user) {
  if (user) {
    if (user.subscription) {
      if (user.subscription.isActive) {
        return true;
      }
    }
  }
  return false;
}

// ✅ 提前返回，扁平化
function isUserEligible(user) {
  if (!user) return false;
  if (!user.subscription) return false;
  return user.subscription.isActive;
}
```

### 避免否定条件

```javascript
// ❌ 否定条件增加认知负担
if (!user.isNotActive()) { }

// ✅ 肯定条件更直观
if (user.isActive()) { }
```

---

## 4. 错误处理 (Error Handling)

### 抛出异常优于返回错误码

```javascript
// ❌ 调用方需要手动检查错误码
const result = calculateTotal(items);
if (result.error) { /* 处理错误 */ }

// ✅ 异常自动传播到合适的处理层
try {
  const total = calculateTotal(items);
} catch (e) {
  console.error('计算失败:', e.message);
}
```

### 提供有意义的错误信息

```javascript
// ❌ 无信息量的错误
throw new Error('Error');

// ✅ 上下文清晰
throw new Error(`无法计算总价: 商品列表为空 (items: ${items.length})`);
```

---

## 5. 类与对象 (Classes & Objects)

### 使用类封装状态和行为

```javascript
// ❌ 过程式：数据和操作分离
const user = { name: 'Alice', email: 'alice@example.com' };
function sendEmailToUser(user, message) { }

// ✅ 面向对象：封装相关行为
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
  sendEmail(message) { }
}
```

### 优先组合而非继承

```javascript
// ❌ 继承层次过深
class Employee extends Person { }
class Manager extends Employee { }

// ✅ 组合：更灵活，无继承耦合
class Employee {
  constructor(person, department) {
    this.person = person;
    this.department = department;
  }
}
```

---

## 6. SOLID 原则速查

| 原则 | 核心思想 | 检查点 |
|------|----------|--------|
| **S**ingle Responsibility | 一个类/函数只做一件事 | 类名能否用"和"连接多个职责？ |
| **O**pen/Closed | 对扩展开放，对修改关闭 | 新增功能时是否需要修改旧代码？ |
| **L**iskov Substitution | 子类可以替换父类 | 子类是否违反了父类的契约？ |
| **I**nterface Segregation | 客户端不依赖不需要的接口 | 接口是否包含无关方法？ |
| **D**ependency Inversion | 依赖抽象，不依赖具体实现 | 是否直接 `new` 了具体类？ |

---

## 7. 注释与文档 (Comments)

### 代码即文档：优先用清晰代码替代注释

```javascript
// ❌ 注释解释代码在做什么
// 如果日期大于当前日期则返回 true
function isFuture(date) {
  return date > new Date();
}

// ✅ 函数名本身已说明意图
function isFutureDate(date) {
  return date > new Date();
}
```

### 注释应解释"为什么"而非"做什么"

```javascript
// ❌ 描述显而易见的行为
// 遍历用户列表
users.forEach(user => { });

// ✅ 解释业务理由
// 必须按注册时间排序，因为后续优惠券发放依赖此顺序
users.sort((a, b) => a.registeredAt - b.registeredAt);
```

---

## 8. 格式化速查

| 项目 | 建议 |
|------|------|
| 缩进 | 2 空格（与项目 .editorconfig 一致） |
| 行宽 | ≤ 100 字符 |
| 空行 | 函数之间留 1 行；逻辑段落之间留 1 行 |
| 命名 | 变量/函数：camelCase；常量：UPPER_SNAKE_CASE；类：PascalCase |
| 引号 | 单引号（JS），反引号（模板字符串） |
| 分号 | 使用 ASI（自动分号插入）时保持一致；或统一使用分号 |

---

> 📖 **完整规范**：`docs/standards/code-standards/README.md`（clean-code-javascript submodule，2386 行）
