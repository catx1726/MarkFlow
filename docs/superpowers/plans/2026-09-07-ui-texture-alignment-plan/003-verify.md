# Task 003: 三层验证

## Context

样式改动预期不影响任何测试断言,但须先补跑基线(会话中首次 `npm test` 被 Driver 中止,基线未建立)。

## Verification Steps

### Layer 1 自动化证据

```bash
npm run lint   # 期望 0 errors
```

### Layer 2 计算型证据

```bash
npm test       # 先记录改动前基线(git stash),再验证改动后全通过
npm run build  # exit 0
```

### Layer 3 推理型证据(可选,UI 可见变更建议执行)

```bash
npm run dev    # 加载扩展,人工对照以下界面明暗两模式截图:
               # popup / sidepanel(搜索、标签、存储管理器、空态、两个模态、下拉菜单)
```

对照基准:宣传页 `docs/index.html`(neutral 色板、零阴影、圆角收敛、琥珀唯一强调)。

## 合规 BLOCKING 勾选

- [x] 用户输入校验 — 不涉及(无输入处理逻辑变更)
- [x] 无敏感信息硬编码 — 改动仅 class/色值 token
- [ ] 特征测试或现有测试通过 — 待本 task 执行确认
