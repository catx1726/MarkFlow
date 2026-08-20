import type { Messages } from '../index'

/**
 * English dictionary — must be structurally identical to zh-CN (Messages).
 * Missing keys cause compile-time errors.
 */
export const en: Messages = {
  common: {
    confirm: 'OK',
    cancel: 'Cancel',
    delete: 'Delete',
    save: 'Save',
    create: 'Create',
    copy: 'Copy',
    done: 'Done',
    export: 'Export',
    rename: 'Rename',
    manageTags: 'Manage tags',
    inbox: 'Inbox',
    untitledSection: 'Untitled section',
    uncategorizedNotes: 'Uncategorized notes',
    uncategorizedMark: 'Uncategorized',
  },
  popup: {
    markCountPrefix: 'You have created',
    markCountSuffix: 'marks.',
    openSettings: 'Settings',
    openSidePanel: 'Open sidebar',
    enableOnSite: 'Enable on this site',
    disableOnSite: 'Disable on this site',
    reloadRequired: 'Settings updated. Reload the page to apply.',
    reloadNow: 'Reload now',
  },
  sidepanel: {
    title: 'Marks',
    searchPlaceholder: 'Search marks, pages, or tags...',
    newTag: 'New tag',
    newTagPlaceholder: 'New tag...',
    openSettings: 'Open settings',
    showMatchesOnly: 'Show matches only',
    clearSearch: 'Clear search',
    emptyTitle: 'No marks yet',
    emptyHint: 'Hold ALT and select text on any page to try it',
    emptyFolder: 'No marks yet',
    noSearchResults: 'No marks matching "{query}"',
    tagPickerTitle: 'Tags',
    renameTagTitle: 'Rename tag',
    renameTagPlaceholder: 'Enter a new tag name',
    deleteTag: 'Delete tag',
    confirmDeletePageMarks: 'Delete all marks on this page? This cannot be undone.',
    confirmDeleteGroupMarks: 'Delete all marks in group "{title}"?',
    confirmDeleteTag: 'Delete tag "{name}"? Marks will be moved back to Inbox instead of being deleted.',
    confirmDeleteMark: 'Delete this mark?',
    inboxUndeletable: 'Inbox is the default container and cannot be deleted.',
    positionChanged: 'Original position changed',
    sectionLabel: 'Section: ',
    addNote: 'Click to add a note...',
    moreActions: 'More actions',
    expandMark: 'Expand mark',
    collapseMark: 'Collapse mark',
    expandNote: 'Expand note',
    collapseNote: 'Collapse note',
    copyMark: 'Copy mark',
    deleteMark: 'Delete mark',
    clearMarks: 'Clear marks',
    groupActions: 'Group actions',
    storageSpace: 'Storage',
    collapse: 'Collapse',
    expandStorage: 'Expand storage manager',
    usedSpace: 'Used: ',
    noKnownLimit: 'No known limit',
    cleanupOldMarks: 'Clear marks older than {days} days',
    cleanupNoNoteMarks: 'Clear marks without notes',
    confirmCleanupOld: 'Clear all marks older than {days} days? This cannot be undone.',
    confirmCleanupNoNote: 'Clear all marks without notes? This cannot be undone.',
    markLabel: 'Mark: ',
    noteLabel: 'Note: ', // Trailing space is intentional (zh uses full-width colon instead) — do not trim
    sourceLabel: 'Source: ', // ditto
    tagLabel: 'Tag: ',
    groupLabel: 'Group: ',
  },
  options: {
    settingsTitle: 'Settings',
    navGeneral: 'General',
    languageLabel: 'Language',
    languageDesc: 'Choose the language for the extension UI. "Follow browser" uses your browser\'s display language.',
    languageAuto: 'Follow browser',
    languageZh: '中文',
    languageEn: 'English',
    saveSettings: 'Save settings',
    savedShort: 'Saved ✓',
    settingsSaved: 'Settings saved!',
    alertTitle: 'Notice',
    navWelcome: 'Welcome',
    defaultColor: 'Default highlight color',
    highlightHeight: 'Highlight height',
    colorPalette: 'Highlight colors',
    shortcuts: 'Shortcuts',
    blacklist: 'Site blacklist',
    errorLogs: 'Error logs',
    githubSync: 'GitHub sync',
    welcomeTitle: '👋 Welcome to MarkFlow',
    quickStartTitle: '🚀 Quick start',
    quickStartPrefix: 'On any page, hold ',
    quickStartSuffix: ' and drag to select text to bring up the highlight toolbar.',
    coreFeaturesTitle: '✨ Core features',
    featureMarkName: 'Mark',
    featureMarkDesc: ': colorful highlights to capture ideas',
    featureReviewName: 'Review',
    featureReviewDesc: ': browse all your marked snippets',
    featureJumpName: 'Jump',
    featureJumpDesc: ': click to jump back to the original context',
    featureOrganizeName: 'Organize',
    featureOrganizeDesc: ': keep knowledge fragments organized',
    thanksTitle: '❤️ Thanks & support',
    thanksDesc: 'Thanks for using MarkFlow! If you find it helpful, please rate it in the store or share it with friends.',
    defaultColorDesc: 'Choose the color used by default for new highlights.',
    highlightHeightDesc: 'Control the underline thickness and bottom spacing of highlights (1–20px).',
    previewLabel: 'Preview: ',
    previewText: 'This is a sample highlighted text',
    colorPaletteDesc: 'Customize the color options available in the tooltip.',
    removeColor: 'Remove color',
    addColor: 'Add color',
    minOneColor: 'Keep at least one highlight color.',
    shortcutsDesc: 'Customize shortcuts for save and delete actions (e.g. Alt+S, Ctrl+Shift+D).',
    shortcutSaveLabel: 'Save mark:',
    shortcutDeleteLabel: 'Delete mark:',
    blacklistDesc: 'Disable the extension on these sites. Enter one domain per line (e.g. example.com).',
    errorLogsDesc: 'If the extension misbehaves, export the error logs and send them to us.',
    exportLogs: 'Export error logs',
    syncGuide: 'Guide',
    syncDesc: 'Sync marks across devices with GitHub Gist. Data is stored as a private Gist.',
    tokenScopePrefix: 'Make sure the token has the ',
    tokenScopeSuffix: ' scope (no repo scope needed).',
    generateToken: 'Generate a token',
    tokenWarning: '⚠️ Note: the token is stored locally and privately in your browser. Use minimal scopes.',
    reconnect: 'Reconnect',
    connectAndSync: 'Connect & sync',
    syncFailed: 'Sync failed',
    syncConnected: 'Connected to cloud sync',
    lastSync: 'Last sync: ',
    enableAutoSync: 'Enable auto sync',
    enterToken: 'Enter your GitHub Token first',
    connecting: 'Connecting to GitHub...',
    connectedExisting: 'Connected to the existing sync Gist!',
    createdNewGist: 'Created a new sync Gist and enabled sync!',
    connectFailed: 'Connection failed: {message}',
  },
  tooltip: {
    tagsLabel: 'Tags',
    noTags: 'No tags yet',
    newTagPlaceholder: '+ New tag',
    tagCreated: 'Created',
    notePlaceholder: 'Write down your notes or thoughts...',
    copyText: 'Copy text',
    saveChanges: 'Save changes',
    confirmHighlight: 'Highlight',
  },
  modal: {
    title: 'Confirm mark position',
    searchPlaceholder: 'Search candidates...',
    locating: 'Locating',
    discardTitle: 'The content was deleted; discard this mark permanently',
    discard: 'Discard',
    noMatches: 'No matches found',
    confirmRestore: 'Restore ({count})',
  },
  sync: {
    helpTitle: 'GitHub Sync Guide',
    helpContent: `
      <div class="space-y-4">
        <section>
          <h4 class="font-bold text-amber-700 dark:text-amber-400 mb-1">🔑 Your token is your identity</h4>
          <p>Sync relies entirely on the GitHub Personal Access Token you generate. The extension <b>never</b> uploads your token to any server; it is stored encrypted locally in this browser.</p>
        </section>

        <section>
          <h4 class="font-bold text-amber-700 dark:text-amber-400 mb-1">💾 Back up your token</h4>
          <p class="text-amber-700 dark:text-amber-400"><b>Strongly recommended:</b> copy the token and store it in your password manager (e.g. 1Password, Bitwarden) or a local document.</p>
          <p>If you switch computers or reinstall the browser, you will need the <b>same token</b> to recover your previously synced data.</p>
        </section>

        <section>
          <h4 class="font-bold text-amber-700 dark:text-amber-400 mb-1">🌐 How multi-device sync works</h4>
          <p>When you install MarkFlow in a second browser, just enter the same token. The extension uses it to find your cloud Gist and merge the data.</p>
        </section>

        <section>
          <h4 class="font-bold text-amber-700 dark:text-amber-400 mb-1">🔒 Data privacy</h4>
          <p>Your data lives in a <b>Secret Gist</b> under your own account, accessible only to holders of that token.</p>
        </section>

        <section>
          <h4 class="font-bold text-amber-700 dark:text-amber-400 mb-1">📊 Storage limits & health</h4>
          <p>Each sync is capped at about <b>10MB</b> by the GitHub API — enough for tens of thousands of records.</p>
          <p class="text-[12px] text-gray-500 mt-1">If sync fails, try deleting unneeded page groups in the sidebar to free up space, then retry.</p>
        </section>
      </div>
    `,
    sizeWarning: '[Sync Warning] Sync data is approaching the limit ({size}MB / 10MB). Clear unneeded marks to keep sync stable.',
    errorStorageLimit: 'Sync failed: data exceeds the GitHub Gist limit (10MB). Clear some marks and try again.',
    errorAuth: 'Authentication failed. Check that your token is valid (401).',
    rateLimitRetryIn: ', retry in {seconds}s',
    rateLimitRetryLater: ', please retry later',
    rateLimited: 'GitHub rate limit reached{hint} (your token is still valid; sync stays on)',
    errorForbidden: 'Insufficient permissions or invalid token: {message}',
    unknownForbiddenReason: 'unknown 403 reason',
    errorApiFailed: 'GitHub API request failed: {status}',
    errorApiDetail: ' ({message})',
    gistNotFound: 'Sync Gist not found. Check the Gist ID.',
    createGistFailed: 'Failed to create sync Gist',
    syncFileMissing: 'markflow_sync.json not found in the sync Gist',
    cloudFileEmpty: 'Cloud sync file is empty. Local data will be uploaded on the next change.',
  },
}
