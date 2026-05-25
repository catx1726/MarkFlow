/**
 * MarkFlow 国际化与静态文本资源管理
 * 
 * 按照用户建议，将复杂的提示说明、帮助文档等提炼至此。
 * 未来可进一步对接标准 WebExtension i18n (messages.json)。
 */

export const i18n = {
  zh: {
    sync: {
      helpTitle: 'GitHub 同步使用指南',
      helpContent: `
        <div class="space-y-4">
          <section>
            <h4 class="font-bold text-blue-600 dark:text-blue-400 mb-1">🔑 Token 即身份</h4>
            <p>同步功能完全依赖您生成的 GitHub Personal Access Token。插件<b>不会</b>上传您的 Token 到任何服务器，仅加密存储在当前浏览器本地。</p>
          </section>
          
          <section>
            <h4 class="font-bold text-blue-600 dark:text-blue-400 mb-1">💾 请妥善备份 Token</h4>
            <p class="text-amber-600 dark:text-amber-400"><b>强烈建议：</b>请将生成的 Token 复制并保存在您的密码管理器（如 1Password, Bitwarden）或本地文档中。</p>
            <p>一旦更换电脑或重装浏览器，您需要填入<b>相同的 Token</b> 才能找回之前同步的数据。</p>
          </section>

          <section>
            <h4 class="font-bold text-blue-600 dark:text-blue-400 mb-1">🌐 多端同步原理</h4>
            <p>当您在第二个浏览器安装 MarkFlow 时，只需填入相同的 Token，插件会自动通过 Token 找到云端的 Gist 数据并进行合并。</p>
          </section>

          <section>
            <h4 class="font-bold text-blue-600 dark:text-blue-400 mb-1">🔒 数据隐私</h4>
            <p>您的数据存储在您账号下的 <b>Secret Gist</b>（私有代码片段）中，只有持有该 Token 的人可以访问。</p>
          </section>

          <section>
            <h4 class="font-bold text-blue-600 dark:text-blue-400 mb-1">📊 存储上限与健康</h4>
            <p>单次同步受 GitHub API 限制上限约为 <b>10MB</b>。这足以容纳数万条记录。</p>
            <p class="text-[12px] text-gray-500 mt-1">若遇到同步失败，请尝试在侧边栏删除部分不再需要的网页分组，物理清理空间后再试。</p>
          </section>
        </div>
      `
    }
  }
}

/**
 * 获取翻译文本的简易封装 (未来可替换为真 i18n 库)
 */
export function t(path: string, lang: 'zh' = 'zh'): string {
  const keys = path.split('.')
  let current: any = i18n[lang]
  for (const key of keys) {
    current = current?.[key]
    if (!current) return path
  }
  return current
}
