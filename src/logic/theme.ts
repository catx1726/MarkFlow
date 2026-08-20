/**
 * 主题解析与共享（手动切换 + 跟随系统）
 *
 * 三个页面（popup/sidepanel/options）与 content script 统一从这里取 isDark，
 * 替代原先各处独立的 usePreferredDark()。
 *
 * 防 FOUC：主题选择同步镜像到 localStorage（markflow-theme），
 * 供 theme-init.ts 在 Vue 挂载前同步读取（storage 是异步的，来不及）。
 */
import { usePreferredDark } from '@vueuse/core'
import { computed, watch } from 'vue'
import { settings } from '~/logic/settings'

export type ThemePref = 'auto' | 'light' | 'dark'

export const THEME_CACHE_KEY = 'markflow-theme'

/** 纯函数：解析最终是否深色（抽出以便单测） */
export function resolveTheme(pref: ThemePref, systemDark: boolean): boolean {
  return pref === 'auto' ? systemDark : pref === 'dark'
}

const preferredDark = usePreferredDark()

/** 解析后的当前主题（响应式，语言切换式自动生效） */
export const isDark = computed(() => resolveTheme(settings.value.theme ?? 'auto', preferredDark.value))

// 镜像到 localStorage 供 theme-init.ts 防 FOUC 使用
watch(
  () => settings.value.theme,
  (theme) => {
    try {
      localStorage.setItem(THEME_CACHE_KEY, theme ?? 'auto')
    }
    catch {
      // localStorage 不可用时静默（如部分隐私模式）
    }
  },
  { immediate: true },
)
