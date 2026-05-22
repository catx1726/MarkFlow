# 发布标准 (Release Standards)

本文档定义了项目的发布流程，确保版本号、更新日志和分发渠道的一致性。

## 发布流程

### 1. 版本确认
- 检查当前 Git Tag 和 Release 记录，确定下一个版本号。
- 遵循语义化版本 (SemVer) 原则：`主版本号.次版本号.修订号`。

### 2. 内容确认
- 审查自上个版本以来的所有提交 (`git log <last_tag>..HEAD`)。
- 结合 `docs/superpowers/plans/` 和 `docs/superpowers/specs/` 明确本次版本的主要功能和修复。

### 3. 执行发布
#### 3.1 更新本地版本号
- 修改 `package.json` 中的 `version` 字段。
- 运行构建脚本以确保版本号同步到构建产物（如 `npm run build`）。

#### 3.2 创建 Git Tag & Release
- 创建新的 Git Tag: `git tag -a v<version> -m "Release v<version>"`。
- 在 GitHub/Gitee 上创建 Release，并根据提交记录编写 "What's New"。

#### 3.3 更新分发渠道
- 更新 `docs/index.html` 中的下载地址，确保指向最新的 Release 产物。
- 如果有静态页面分发（如 Chrome Web Store 链接），确保信息是最新的。

## 自动化建议
- 尽可能使用脚本自动更新版本号和生成 CHANGELOG。
- 最终发布应由 CI/CD 流程触发（如果已配置）。
