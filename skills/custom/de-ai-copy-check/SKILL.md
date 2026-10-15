---
name: de-ai-copy-check
description: Use when drafting or reviewing any outward-facing copy (social posts, store listings, README intros, release notes) to strip AI-writing tells before publication. Covers the Wikipedia "Signs of AI writing" checklist, Chinese-specific tells (翻译腔/模板句/否定对仗), platform-native style exemptions, and the evidence-recording workflow.
---

# 外发文案去 AI 味检查 (De-AI Copy Check)

## Overview

所有对外发布的文案（Reddit/小红书/B站/商店页/Release Notes）在定稿前必须过一遍 AI 味检查。
本技能沉淀自 MarkFlow 双语宣传稿实战（2026-09-22）：英文版走了完整 Wikipedia 特征表自查，
中文版初稿漏检、补检时仍检出 4 处问题——**写过一遍英文检查不代表中文稿自动干净，两种语言的 AI 味特征不同，每篇都要独立过检**。

实证案例（本仓库，gitignored）：
- `notes/2026.09.22_markflow-reddit-en.md` 附录一——英文检查完整记录（特征表、工具调研、4 处修改）
- `notes/2026.09.22_markflow-xiaohongshu.md` 附录——中文补检记录（4 处修复 + 3 项平台豁免）

---

## When to Use

- [ ] 起草或修改任何**对外发布**的文案（社交帖、商店描述、官网落地页、README 首屏）
- [ ] 把内部文档改写成宣传/公告口径时
- [ ] 审查 AI 生成的文案草稿准备发出前

**不触发**：内部技术文档、代码注释、commit message、issue 讨论（效率优先，无读者感知问题）。

---

## 检查清单

### 英文（依据 Wikipedia: Signs of AI writing，检测社区公认特征表）

| 特征 | 说明 | 经验阈值/处理 |
| :--- | :--- | :--- |
| 否定对仗 | "Not X, but Y" / "Not just X, but also Y" | **最高频 AI 句式**，一律改写为平实陈述 |
| 破折号过密 | em dash 滥用 | 每 200-300 词 ≤1 个，多余改句号/逗号 |
| 强制三连 | rule of three 排比（"fast, simple, and reliable"） | 删减到实际需要的个数 |
| 列表体标记 | "Fun facts:"、"Here are X things:" | 改为自然过渡句 |
| 模板收尾 | "I'd love to hear..."、"Let me know..." | 改为具体、短小的真实提问 |
| AI 高频词 | delve、leverage、robust、tapestry、seamless | 换普通词 |

### 中文特有（英文清单查不出来的）

| 特征 | 实例（本项目实检） | 改法 |
| :--- | :--- | :--- |
| 翻译腔 | 「坦诚说一个局限」（直译 honestly speaking） | 「它也有个短板，得先说清楚」 |
| 模板缓冲句 | 「我想要的其实很简单」 | 「我想要的不多：…就行」 |
| 否定对仗 | 「而不是默默跳错地方」（与英文同源问题） | 「会先提醒你一声，不会让你对着错误的段落发懵」 |
| 列表体标记 | 「两个小彩蛋🥚」（= "Fun facts:"） | 「对了，还有两个彩蛋🥚」 |

> 中文检查的难点：很多 AI 味句式同时也是营销号常用句式，边界模糊。判断标准——**这句话像不像一个真人在口语里会说的话**。

---

## 平台豁免规则

平台原生风格**豁免检查，但不免检**——每项豁免必须在文档中注明理由：

| 平台 | 可保留 | 豁免理由示例 |
| :--- | :--- | :--- |
| 小红书 | 每段 emoji、👇、✅ 列表、双问题收尾 | 真人笔记同样高频，属平台原生图文惯例 |
| Reddit | 无（Reddit 对营销腔最敏感，从严） | — |
| B站 | 口播稿的语气词、弹幕互动句式 | 视频媒介原生 |

判断依据：**该平台真人高赞内容是否也这么写**。AI 味检查的目标是让文案像人写的，不是让文案像另一个平台的。

---

## 工作流

1. **对照清单逐项扫描**全文（英文表 + 中文表，与文案语言对应；双语文案各扫一遍）
2. **记录表**：检出问题按 `原句 | 问题 | 改法` 三列记录
3. **豁免表**：保留项按 `项目 | 保留理由` 记录
4. **写入稿子附录**：两个表随稿归档（证据链，便于复盘和二次修改时不改回去）
5. **改写原则**：只改有问题的句子，不为追求「0% AI 味」整体重写——过度改写会丢失原有的自然表达

## 工具使用原则

- **检测器（GPTZero/ZeroGPT/Copyleaks）误报率高，只作参考**，不作为放行标准；人工清单比对是主流程
- 商业化「去 AI 味」改写工具（Undetectable AI 等）谨慎使用：可能引入新的模板腔，且改写后仍需人工复扫
- 权威特征表保持更新：en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing

---

## 失效信号（何时更新本技能）

- Wikipedia 特征表新增高频条目 → 同步到检查清单
- 新平台（如 Twitter/X、即刻）首次发文 → 补一行平台豁免表
- 某篇过检文案被读者指出「像 AI 写的」→ 把漏检句式补进中文/英文表
