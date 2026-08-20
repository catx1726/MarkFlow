// 在外部模块中提前设置主题，避免 FOUC 并遵守 CSP（禁止 inline script）
// 优先读 localStorage 镜像的手动主题（见 src/logic/theme.ts），否则跟随系统
const cachedTheme = localStorage.getItem('markflow-theme')
const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
const isDark = cachedTheme && cachedTheme !== 'auto' ? cachedTheme === 'dark' : systemDark
if (isDark) {
  document.documentElement.classList.add('dark')
}
