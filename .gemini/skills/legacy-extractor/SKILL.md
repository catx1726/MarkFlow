---
name: legacy-extractor
description: 专门用于从无文档、仅有配置文件的旧项目中逆向识别 SOP 资产并引导提纯。
mode: step-by-step
---

# 逆向提炼操作协议 (Legacy Extractor)

## Overview
本技能负责从旧项目中识别高价值逻辑资产。它的核心职责是“路径扫描”与“核心发现”，并将发现的资产引流至 `meta-distiller` 执行标准化的提纯反哺。

## When to Use
- 接手无文档的旧项目（Legacy Project）。
- 识别项目中的核心业务逻辑（如：渲染器、复杂协议、算法）。
- 准备将旧代码反哺至母库 Pattern 库。

## Implementation Workflow (Step-by-Step)

### 1. 基因识别 (Environment Spec)
- [ ] **扫描环境**：读取 `package.json` 中的 `dependencies` 和 `engines`。
- [ ] **生成主规格**：根据母库 `env_schema` 生成 `openspec/specs/env.md`。

### 2. 路径扫描 (Core Discovery)
- [ ] **执行文件树扫描**：运行 `ls -R src/`。
- [ ] **定位核心点**：询问用户哪些是核心业务逻辑所在位置（如：Canvas 逻辑、API 拦截器）。

### 3. 核心逻辑识别 (Logic Identification)
- [ ] **精准分析**：仅读取用户确认的 2-3 个核心文件。
- [ ] **建立资产清单**：在当前会话中列出识别到的高价值逻辑块，禁止直接写入 `logic.md`。

### 4. 资产引流 (Handover to Distiller)
- [ ] **触发提纯**：引导用户激活 `meta-distiller` 技能。
- [ ] **反哺母库**：按照 `meta-distiller` 规约将逻辑参数化并存入母库暂存区（distill_stage）。

### 5. 终期审计
- [ ] **归档准备**：检查本项目的资产发现记录，确保所有识别到的高价值点均已进入提纯流。

## Common Mistakes & Red Flags
- **全量扫描**：试图一次性读取整个项目目录。
- **本地堆积**：将大量代码实现直接写进 `openspec/specs/logic.md`。*修正：逻辑实现必须流向母库 patterns/。*
- **忽略去业务化**：在识别资产时未考虑其通用性。
