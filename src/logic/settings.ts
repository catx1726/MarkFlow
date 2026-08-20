import { useWebExtensionStorage } from '~/composables/useWebExtensionStorage'

export const defaultSettings = {
  defaultHighlightColor: '#FFFF00', // yellow
  highlightColors: [
    '#FFFF00', // yellow
    '#99FF99', // green
    '#FF9999', // red
    '#99CCFF', // blue
    '#FFCC99', // orange
  ],
  blacklist: [] as string[],
  shortcutSave: 'Alt+S',
  shortcutDelete: 'Alt+D',
  autoAssociation: true,
  highlightHeight: 5,
  lastUsedTags: [] as string[], // 上次新建标记时选中的标签 id（本地偏好，不同步）
  language: 'auto' as 'auto' | 'zh-CN' | 'en', // UI 语言：auto 跟随浏览器（本地偏好，不同步）
}

export function isPageBlacklisted(url: string, blacklist: string[]): boolean {
  try {
    const hostname = new URL(url).hostname
    return blacklist.some(pattern => hostname.endsWith(pattern))
  }
  catch {
    return false
  }
}

export const { data: settings, dataReady: settingsReady } = useWebExtensionStorage('webext-settings', defaultSettings)
