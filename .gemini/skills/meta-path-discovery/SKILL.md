---
name: meta-path-discovery
description: 用于自动定位母库（Foundry）根目录，通过向上递归寻找 .gemini/global_standard.md 实现。
---

# 元路径探测 (Foundry Locator)

## Overview
本元技能为 AI 提供了一套自动定位 **Foundry 根目录** 的算法。它通过递归的文件系统扫描，彻底消除了对物理绝对路径的依赖。

## When to Use
- 当任何技能需要引用母库中的文件（如 `patterns/`, `schemas/`）时。
- 在初始化阶段建立 `link.json` 存根时。
- 当在指令中遇到 `{{FOUNDRY_ROOT}}` 占位符时。

## 探测算法 (Discovery Algorithm)

为了找到 `{{FOUNDRY_ROOT}}`，请按顺序执行以下步骤：

1. **检查工作区配置**：
   读取当前工作目录下的 `.gemini/config.json`。如果 `skillPaths` 指向的目录包含 `.gemini/global_standard.md`，该目录即为 **Foundry 根目录**。

2. **递归向上搜索 (The Climb)**：
   从当前目录开始，逐级向上寻找包含 `.gemini/global_standard.md` 的文件夹。
   - **步骤 A**：当前目录有该文件吗？有则停止。
   - **步骤 B**：移动到父目录，重复步骤 A。
   - **限制**：抵达磁盘根目录（如 `C:\` 或 `/`）时停止。

3. **链路存根检查**：
   读取 `.gemini/link.json` 中的 `foundryPath` 值。

## 输出标准
一旦定位成功，AI 必须在当前会话上下文中缓存该路径，并用其替换后续所有的 `{{FOUNDRY_ROOT}}` 实例。

## Red Flags
- 未执行探测直接使用绝对路径（如 `D:\code\...`）。
- 未验证目标路径下是否存在 `global_standard.md` 关键指纹。
