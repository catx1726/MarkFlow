import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    // kebab-case 自定义事件为本仓库约定（emit 声明与模板监听器一致）；
    // 该规则对 Vue 模板监听器的 camelCase 要求在 PR #72 审查中判定为误报，予以关闭
    'vue/custom-event-name-casing': 'off',
  },
})
