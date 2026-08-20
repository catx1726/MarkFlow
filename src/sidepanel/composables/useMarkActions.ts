import { toRaw } from 'vue'
import { sendMessage } from 'webext-bridge/options'
import browser from 'webextension-polyfill'
import TurndownService from 'turndown'
import type { Mark } from '~/logic/storage'
import type { MarkGroup } from '~/logic/tagTree'
import { t } from '~/logic/i18n'

export function useMarkActions() {
  const turndownService = new TurndownService()
  turndownService.addRule('strikethrough', {
    filter: ['del', 's', 'strike' as any],
    replacement: content => `~~${content}~~`,
  })

  function getNormalizedUrl(url: string | URL): string {
    const urlObj = typeof url === 'string' ? new URL(url) : url
    let path = urlObj.pathname
    if (path.length > 1 && path.endsWith('/'))
      path = path.slice(0, -1)
    return urlObj.origin + path
  }

  async function gotoMark(mark: Mark) {
    const allTabs = await browser.tabs.query({ currentWindow: true })
    const targetUrl = getNormalizedUrl(mark.url)
    const tab = allTabs.find((t) => {
      if (!t.url)
        return false
      try {
        return getNormalizedUrl(t.url) === targetUrl
      }
      catch {
        return false
      }
    })

    if (tab?.id) {
      await browser.tabs.update(tab.id, { active: true })
      sendMessage('goto-mark', { markId: mark.id }, { context: 'content-script', tabId: tab.id })
    }
    else {
      const urlWithHash = new URL(mark.url)
      urlWithHash.hash = `__highlight-mark__${mark.id}`
      await browser.tabs.create({ url: urlWithHash.href, active: true })
    }
  }

  async function removeMark(mark: Mark) {
    // eslint-disable-next-line no-alert
    if (!confirm(t('sidepanel.confirmDeleteMark')))
      return
    try {
      const result = await sendMessage('remove-mark', toRaw(mark), 'background')
      if (result && (result as any).success === false) {
        console.error('Failed to remove mark:', (result as any)?.error)
        return
      }
    }
    catch (error) {
      console.error('Failed to send remove-mark message:', error)
      return
    }

    // Notify content script
    const allTabs = await browser.tabs.query({ currentWindow: true })
    const targetUrl = getNormalizedUrl(mark.url)
    const tab = allTabs.find((t) => {
      if (!t.url)
        return false
      try {
        return getNormalizedUrl(t.url) === targetUrl
      }
      catch {
        return false
      }
    })
    if (tab?.id) {
      sendMessage('remove-mark', toRaw(mark), { context: 'content-script', tabId: tab.id }).catch(() => {})
    }
  }

  async function saveNote(markId: string, url: string, note: string) {
    await sendMessage('update-mark-details', { id: markId, url, note }, 'background')
  }

  async function copyMarkText(mark: Mark) {
    try {
      await navigator.clipboard.writeText(`${t('sidepanel.markLabel')}${mark.text}\n` + `${t('sidepanel.noteLabel')}${mark.note}`)
      return true
    }
    catch {
      return false
    }
  }

  function exportToMarkdown(urlData: { pageTitle: string, groups: MarkGroup[] }) {
    const { pageTitle, groups } = urlData
    const firstMark = groups.length > 0 && groups[0].marks.length > 0 ? groups[0].marks[0] : null
    const pageURL = firstMark?.url || ''
    let markdown = `> ${t('sidepanel.sourceLabel')}[${pageTitle}](${pageURL})\n\n---\n\n`
    for (const group of groups) {
      markdown += `**${group.title}**\n\n`
      for (const mark of group.marks) {
        if (mark.html) {
          try {
            const contentMd = turndownService.turndown(mark.html)
            markdown += `${contentMd}\n\n`
          }
          catch {
            markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
          }
        }
        else {
          markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
        }
        if (mark.note)
          markdown += `**${t('sidepanel.noteLabel')}**${mark.note}\n\n`
        markdown += `---\n\n`
      }
    }
    downloadMarkdown(markdown, pageTitle)
  }

  function exportTagFolder(folder: { tagName: string, pages: Record<string, any> }) {
    let markdown = `**${t('sidepanel.tagLabel')}${folder.tagName}**\n\n---\n\n`
    for (const [url, urlData] of Object.entries(folder.pages)) {
      const { pageTitle, groups } = urlData as any
      markdown += `**[${pageTitle}](${url})**\n\n`
      for (const group of groups) {
        markdown += `*${group.title}*\n\n`
        for (const mark of group.marks) {
          if (mark.html) {
            try {
              markdown += `${turndownService.turndown(mark.html)}\n\n`
            }
            catch {
              markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
            }
          }
          else {
            markdown += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
          }
          if (mark.note)
            markdown += `**${t('sidepanel.noteLabel')}**${mark.note}\n\n`
          markdown += `---\n\n`
        }
      }
    }
    downloadMarkdown(markdown, folder.tagName)
  }

  function exportGroup(url: string, group: any) {
    let md = `**${t('sidepanel.groupLabel')}${group.title}**\n\n---\n\n`
    for (const mark of group.marks) {
      if (mark.html) {
        try {
          md += `${turndownService.turndown(mark.html)}\n\n`
        }
        catch {
          md += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
        }
      }
      else {
        md += `> ${mark.text.replace(/>/g, '\\>')}\n\n`
      }
      if (mark.note)
        md += `**${t('sidepanel.noteLabel')}**${mark.note}\n\n`
      md += `---\n\n`
    }
    downloadMarkdown(md, group.title)
  }

  function downloadMarkdown(content: string, fileName: string) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeFileName = fileName.replace(/[/\\?%*:|"<>]/g, '-')
    a.download = `${safeFileName}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    gotoMark,
    removeMark,
    saveNote,
    copyMarkText,
    exportToMarkdown,
    exportTagFolder,
    exportGroup,
    getNormalizedUrl,
  }
}
