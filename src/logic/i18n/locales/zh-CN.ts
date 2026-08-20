/**
 * zh-CN 源语言字典（i18n 类型来源：Messages = typeof zhCN）
 * 组织约定：按界面区域分组（popup/sidepanel/options/tooltip/modal/sync/common）
 * 插值占位：{paramName}
 * 维护约定：新增 key 必须同步更新 en.ts（类型强制同构，tsc 会报错）并跑 npx vitest run src/tests/i18n.spec.ts
 */
export const zhCN = {
  common: {
    confirm: '确认',
    cancel: '取消',
    delete: '删除',
    save: '保存',
    create: '创建',
    copy: '复制',
    done: '完成',
    export: '导出',
    rename: '重命名',
    manageTags: '管理标签',
    inbox: '收集箱 (Inbox)',
    untitledSection: '无标题章节',
    uncategorizedNotes: '未分类笔记',
    uncategorizedMark: '未分类标记',
  },
  popup: {
    markCountPrefix: '你已经创建了',
    markCountSuffix: '条标记。',
    openSettings: '设置',
    openSidePanel: '打开侧边栏',
    enableOnSite: '在此网站启用',
    disableOnSite: '在此网站禁用',
    reloadRequired: '状态已更新，需刷新页面生效。',
    reloadNow: '立即刷新',
  },
  sidepanel: {
    title: '标记管理',
    searchPlaceholder: '搜索标记、页面或标签...',
    newTag: '新建标签',
    newTagPlaceholder: '新建标签...',
    openSettings: '打开设置',
    showMatchesOnly: '仅显示匹配项',
    clearSearch: '清除搜索',
    emptyTitle: '还没有任何标记',
    emptyHint: '在网页上按住ALT，然后选中文本试试看',
    emptyFolder: '暂无标记',
    noSearchResults: '未找到包含「{query}」的标记',
    tagPickerTitle: '标签',
    renameTagTitle: '重命名标签',
    renameTagPlaceholder: '输入新标签名称',
    deleteTag: '删除标签',
    confirmDeletePageMarks: '确定要删除此页面下的所有标记吗？此操作不可撤销。',
    confirmDeleteGroupMarks: '确定要删除分组「{title}」下的所有标记吗？',
    confirmDeleteTag: '确定要删除标签「{name}」吗？标记本身不会被删除，而是移回收集箱。',
    confirmDeleteMark: '确定要删除此标记吗？',
    inboxUndeletable: '收集箱 (Inbox) 是默认容器，无法删除。',
    positionChanged: '原位置已变化',
    sectionLabel: '章节：',
    addNote: '点击添加备注...',
    moreActions: '更多操作',
    expandMark: '展开标记',
    collapseMark: '收起标记',
    expandNote: '展开备注',
    collapseNote: '收起备注',
    copyMark: '复制标记',
    deleteMark: '删除标记',
    clearMarks: '清空标记',
    groupActions: '分组操作',
    storageSpace: '存储空间',
    collapse: '收起',
    expandStorage: '展开存储管理',
    usedSpace: '已用空间: ',
    noKnownLimit: '无已知限制',
    cleanupOldMarks: '清理 {days} 天前的标记',
    cleanupNoNoteMarks: '清理无备注的标记',
    confirmCleanupOld: '确定要清理 {days} 天前的所有标记吗？此操作不可撤销。',
    confirmCleanupNoNote: '确定要清理所有没有备注的标记吗？此操作不可撤销。',
    markLabel: '标记：',
    noteLabel: '备注：',
    sourceLabel: '来源：',
    tagLabel: '标签：',
    groupLabel: '分组：',
  },
  options: {
    settingsTitle: '设置',
    navGeneral: '通用设置',
    languageLabel: '界面语言',
    languageDesc: '选择扩展界面使用的语言。「跟随浏览器」将使用浏览器的界面语言。',
    languageAuto: '跟随浏览器',
    languageZh: '中文',
    languageEn: 'English',
    saveSettings: '保存设置',
    savedShort: '已保存 ✓',
    settingsSaved: '设置已保存！',
    alertTitle: '提示',
    navWelcome: '欢迎使用',
    defaultColor: '默认高亮颜色',
    highlightHeight: '高亮标记高度',
    colorPalette: '高亮颜色配置',
    shortcuts: '快捷键设置',
    blacklist: '网站黑名单',
    errorLogs: '错误日志',
    githubSync: 'GitHub 同步',
    welcomeTitle: '👋 欢迎使用 MarkFlow',
    quickStartTitle: '🚀 快速开始',
    quickStartPrefix: '在任意网页，按住 ',
    quickStartSuffix: ' 键并拖动鼠标选中文字，即可唤起高亮工具栏。',
    coreFeaturesTitle: '✨ 核心功能',
    featureMarkName: '标记 (Mark)',
    featureMarkDesc: '：多彩高亮，捕捉灵感',
    featureReviewName: '回顾 (Review)',
    featureReviewDesc: '：一览所有标记片段',
    featureJumpName: '跳转 (Jump)',
    featureJumpDesc: '：点击快速定位上下文',
    featureOrganizeName: '整理 (Organize)',
    featureOrganizeDesc: '：高效管理知识碎片',
    thanksTitle: '❤️ 致谢与支持',
    thanksDesc: '感谢您的使用！如果您觉得这个工具对您有帮助，欢迎在商店评分或分享给朋友。',
    defaultColorDesc: '选择在创建新高亮时默认使用的颜色。',
    highlightHeightDesc: '控制高亮标记的下划线粗细和底部间距，取值范围 1–20px。',
    previewLabel: '预览：',
    previewText: '这是一段示例高亮文本',
    colorPaletteDesc: '自定义在工具提示中可用的颜色选项。',
    removeColor: '移除颜色',
    addColor: '添加颜色',
    minOneColor: '至少需要保留一种高亮颜色。',
    shortcutsDesc: '自定义保存和删除操作的快捷键 (例如: Alt+S, Ctrl+Shift+D)。',
    shortcutSaveLabel: '保存标记:',
    shortcutDeleteLabel: '删除标记:',
    blacklistDesc: '在以下网站禁用此插件，每行输入一个域名（例如 example.com）。',
    errorLogsDesc: '如果扩展运行异常，请导出错误日志发送给我们。',
    exportLogs: '导出错误日志',
    syncGuide: '使用指南',
    syncDesc: '使用 GitHub Gist 实现多端标记同步。数据以私有 Gist 形式存储。',
    tokenScopePrefix: '请确保 Token 已勾选 ',
    tokenScopeSuffix: ' 权限（无需 repo 权限）。',
    generateToken: '点此快速生成 Token',
    tokenWarning: '⚠️ 注意：Token 将以加密/私有形式存储在浏览器本地，建议使用最小权限。',
    reconnect: '重新连接',
    connectAndSync: '连接并开启同步',
    syncFailed: '同步失败',
    syncConnected: '已连接到云端同步',
    lastSync: '上次同步: ',
    enableAutoSync: '启用自动同步',
    enterToken: '请先输入 GitHub Token',
    connecting: '正在连接 GitHub...',
    connectedExisting: '已成功连接到现有的同步 Gist！',
    createdNewGist: '已创建新的同步 Gist 并开启同步！',
    connectFailed: '连接失败: {message}',
  },
  tooltip: {
    tagsLabel: '关联标签',
    noTags: '暂无标签',
    newTagPlaceholder: '+ 新建标签',
    tagCreated: '已创建',
    notePlaceholder: '在这里记录你的笔记或思考...',
    copyText: '复制文本',
    saveChanges: '保存修改',
    confirmHighlight: '确认高亮',
  },
  modal: {
    title: '确认标记位置',
    searchPlaceholder: '在歧义项中搜索...',
    locating: '寻找位置',
    discardTitle: '由于内容已删除，彻底移除此标记',
    discard: '彻底丢弃',
    noMatches: '未找到匹配项',
    confirmRestore: '确认恢复 ({count})',
  },
  sync: {
    helpTitle: 'GitHub 同步使用指南',
    helpContent: `
      <div class="space-y-4">
        <section>
          <h4 class="font-bold text-amber-700 dark:text-amber-400 mb-1">🔑 Token 即身份</h4>
          <p>同步功能完全依赖您生成的 GitHub Personal Access Token。插件<b>不会</b>上传您的 Token 到任何服务器，仅加密存储在当前浏览器本地。</p>
        </section>

        <section>
          <h4 class="font-bold text-amber-700 dark:text-amber-400 mb-1">💾 请妥善备份 Token</h4>
          <p class="text-amber-700 dark:text-amber-400"><b>强烈建议：</b>请将生成的 Token 复制并保存在您的密码管理器（如 1Password, Bitwarden）或本地文档中。</p>
          <p>一旦更换电脑或重装浏览器，您需要填入<b>相同的 Token</b> 才能找回之前同步的数据。</p>
        </section>

        <section>
          <h4 class="font-bold text-amber-700 dark:text-amber-400 mb-1">🌐 多端同步原理</h4>
          <p>当您在第二个浏览器安装 MarkFlow 时，只需填入相同的 Token，插件会自动通过 Token 找到云端的 Gist 数据并进行合并。</p>
        </section>

        <section>
          <h4 class="font-bold text-amber-700 dark:text-amber-400 mb-1">🔒 数据隐私</h4>
          <p>您的数据存储在您账号下的 <b>Secret Gist</b>（私有代码片段）中，只有持有该 Token 的人可以访问。</p>
        </section>

        <section>
          <h4 class="font-bold text-amber-700 dark:text-amber-400 mb-1">📊 存储上限与健康</h4>
          <p>单次同步受 GitHub API 限制上限约为 <b>10MB</b>。这足以容纳数万条记录。</p>
          <p class="text-[12px] text-gray-500 mt-1">若遇到同步失败，请尝试在侧边栏删除部分不再需要的网页分组，物理清理空间后再试。</p>
        </section>
      </div>
    `,
    sizeWarning: '[Sync Warning] 同步数据量接近限制 ({size}MB / 10MB)。建议清理不再需要的标记以确保同步稳定。',
    errorStorageLimit: '同步失败：数据量超过 GitHub Gist 上限 (10MB)。请清理部分标记后重试。',
    errorAuth: '身份验证失败，请检查 Token 是否有效（401）',
    rateLimitRetryIn: '，请 {seconds} 秒后重试',
    rateLimitRetryLater: '，请稍后重试',
    rateLimited: 'GitHub 请求频率受限{hint}（非 Token 失效，同步不会被关闭）',
    errorForbidden: '权限不足或 Token 无效：{message}',
    unknownForbiddenReason: '未知 403 原因',
    errorApiFailed: 'GitHub API 请求失败: {status}',
    errorApiDetail: '（{message}）',
    gistNotFound: '未找到指定的同步 Gist，请检查 Gist ID',
    createGistFailed: '创建同步 Gist 失败',
    syncFileMissing: '同步 Gist 中未找到 markflow_sync.json 文件',
    cloudFileEmpty: '云端同步文件为空，本地数据将在下次变更时上传。',
  },
}
