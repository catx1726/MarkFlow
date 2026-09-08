# Task 004: 落地页「体验」入口 + 三层验证走查

## Context

体验页组功能完整。本 task 接入落地页入口，并按 Spec §6 执行完整三层验证（docs 无测试管线，以检查清单 + 运行时走查替代单元测试——Driver 已在 Spec 确认该适配）。

## Target Logic

`docs/index.html` hero 链接行（`:114-117`）：

```html
<p class="mt-10 text-sm text-neutral-500 dark:text-neutral-400 flex gap-6">
  <a href="./try/" class="link-line">体验</a>
  <a href="#install" class="link-line">安装</a>
  <a href="#demo" class="link-line">演示</a>
</p>
```

仅此一处改动；不动 EN 版、不动 sitemap。

## Verification（三层证据）

**Layer 1（Hook/CI）**

```bash
node --check docs/try/try.js && echo "syntax OK"
# 提交时 lefthook：conventional-commit + check-docs-structure + ops_changelog 追加
# PR 后 CI：audit_check + spec_plan_sync 必须绿
```

**Layer 2（Generator 自检清单）**

- [ ] 标记创建/标签写入/删除（5 色均试）
- [ ] 本页回跳：居中 + 琥珀脉冲 1s 还原
- [ ] 跨页回跳：hash 进入 → 脉冲 → hash 清除
- [ ] 刷新恢复（位置正确，锚点校验失败置灰逻辑不触发）
- [ ] 重置体验清空
- [ ] 暗色模式（含刷新保持）
- [ ] `prefers-reduced-motion`（脉冲/弹入降级）
- [ ] 窄屏提示条 + 侧栏隐藏
- [ ] 重叠标记拒绝提示

**Layer 3（运行时走查）**

```bash
python3 -m http.server 8000 --directory docs
```

- [ ] Chrome 与 Firefox 各走一遍录屏动线（Task 003 Verification 步骤 1-3）
- [ ] 落地页「体验」→ 进入 A 页；「← MarkFlow」→ 返回落地页
- [ ] 录屏彩排：窗口 1280×800，动线一气呵成无视觉瑕疵
