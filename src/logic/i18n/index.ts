/**
 * MarkFlow i18n 核心
 * Spec: docs/superpowers/specs/2026-08-20-i18n-english-design.md
 *
 * 架构：TS 字典（zh-CN 为源语言与类型来源，en 必须同构——缺失 key 编译期报错）
 * 语言解析：settings.language（auto/zh-CN/en），auto 时跟随浏览器 UI 语言
 * 响应式：t() 在渲染期读取 currentLocale（computed），切换语言自动重渲染
 */
import { computed } from 'vue'
import { en } from './locales/en'
import { zhCN } from './locales/zh-CN'
import { settings } from '~/logic/settings'

export type Messages = typeof zhCN
export type Locale = 'zh-CN' | 'en'

const dictionaries: Record<Locale, Messages> = { 'zh-CN': zhCN, en }

function detectBrowserLocale(): Locale {
  try {
    // content script / 测试环境下 browser 可能不可用
    const lang = (globalThis as any).browser?.i18n?.getUILanguage?.() ?? 'zh-CN'
    return lang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
  }
  catch {
    return 'zh-CN'
  }
}

export const currentLocale = computed<Locale>(() => {
  const pref = settings.value.language
  if (pref === 'zh-CN' || pref === 'en')
    return pref
  return detectBrowserLocale()
})

/**
 * 点路径取值 + 参数插值。
 * @example t('popup.markCount', { count: 5 }) // "你已经创建了 5 条标记。"
 */
export function t(path: string, params?: Record<string, string | number>): string {
  const keys = path.split('.')
  let value: unknown = keys.reduce<unknown>((obj, key) => (obj as any)?.[key], dictionaries[currentLocale.value])
  if (typeof value !== 'string') {
    // 运行时兜底：回退中文，再退化为 key 本身
    value = keys.reduce<unknown>((obj, key) => (obj as any)?.[key], zhCN)
  }
  if (typeof value !== 'string')
    return path
  if (params) {
    for (const [k, v] of Object.entries(params))
      value = (value as string).replaceAll(`{${k}}`, String(v))
  }
  return value as string
}
