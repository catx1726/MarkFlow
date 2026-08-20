import { createApp, watchEffect } from 'vue'
import App from './Sidepanel.vue'
import { setupApp } from '~/logic/common-setup'
import { t } from '~/logic/i18n'
import '../styles'

const app = createApp(App)
setupApp(app)

// 标签页标题 i18n：响应式跟随语言切换
watchEffect(() => {
  document.title = `MarkFlow · ${t('sidepanel.title')}`
})

app.mount('#app')
