---
name: meta-path-discovery
description: Use when needing to locate the project root directory or verify the current working directory is within the project.
---

# Meta Path Discovery (Project Root Locator)

## Overview

本元技能为 AI 提供了一套自动定位**项目根目录**的算法。它通过递归的文件系统扫描，消除对物理绝对路径的依赖，确保所有路径引用都相对于项目根目录。

## When to Use

- 当任何技能需要引用项目根目录下的文件时。
- 当不确定当前工作目录是否在项目内部时。
- 当在指令中遇到相对路径需要解析为绝对路径时。

## Discovery Algorithm

为了找到项目根目录，请按顺序执行以下步骤：

1. **检查当前目录指纹**：
   当前目录是否包含 `AGENTS.md`？有则当前目录即为项目根目录。

2. **递归向上搜索 (The Climb)**：
   从当前目录开始，逐级向上寻找包含 `AGENTS.md` 的文件夹。
   - **步骤 A**：当前目录有该文件吗？有则停止。
   - **步骤 B**：移动到父目录，重复步骤 A。
   - **限制**：抵达磁盘根目录（如 `C:\` 或 `/`）时停止。

3. **备选指纹（Git 仓库）**：
   如果未找到 `AGENTS.md`，则搜索包含 `.git/` 目录的文件夹作为项目根目录。

## Output Standard

一旦定位成功，AI 必须在当前会话上下文中缓存该路径，并用其替换后续所有的相对路径引用。所有 skill 文档中的路径都应相对于项目根目录。

## Red Flags

- 未执行探测直接使用绝对路径（如 `D:\code\...`）。
- 未验证目标路径下是否存在 `AGENTS.md` 或 `.git/` 关键指纹。
- 在子目录中操作时错误地将子目录当作项目根目录。
