// 在外部模块中提前设置主题，避免 FOUC 并遵守 CSP（禁止 inline script）
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark')
}
