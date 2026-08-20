import { createApp, watchEffect } from 'vue'
import App from './Options.vue'
import { setupApp } from '~/logic/common-setup'
import { t } from '~/logic/i18n'
import '../styles'

const app = createApp(App)
setupApp(app)

// 标签页标题 i18n：响应式跟随语言切换（含 settings 异步加载完成后刷新）
watchEffect(() => {
  document.title = `MarkFlow · ${t('options.settingsTitle')}`
})

app.mount('#app')
