import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    // kebab-case 自定义事件为本仓库约定（emit 声明与模板监听器一致）；
    // 该规则对 Vue 模板监听器的 camelCase 要求在 PR #72 审查中判定为误报，予以关闭
    'vue/custom-event-name-casing': 'off',
  },
}, {
  // 宣传片录制工具链：独立 Node 脚本 + 浏览器舞台页，node/prefer-global、no-undef(chrome)
  // 等规则与其运行语境冲突，且产物不进扩展包，整体豁免（flat config 纯 ignores 块即全局忽略）
  ignores: ['scripts/promo-video/**'],
})
