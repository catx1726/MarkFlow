import type { Mark } from '~/logic/storage'
import type { TagTree } from '~/logic/tagTree'

export function isMarkMatch(mark: Mark, terms: string[]): boolean {
  const haystack = [
    mark.text,
    mark.html,
    mark.note,
    mark.title,
    mark.url,
    mark.contextTitle,
  ].filter(Boolean).join(' ').toLowerCase()
  return terms.every(term => haystack.includes(term))
}

export function filterTagTree(tree: TagTree, query: string): TagTree {
  const rawQuery = query.trim()
  if (!rawQuery)
    return tree

  const terms = rawQuery.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0)
    return tree

  const result: TagTree = {}

  for (const [tagId, folder] of Object.entries(tree)) {
    const tagNameMatch = terms.every(term => folder.tagName.toLowerCase().includes(term))
    const matchedPages: typeof folder.pages = {}

    for (const [url, page] of Object.entries(folder.pages)) {
      const pageTitleMatch = terms.every(term => page.pageTitle.toLowerCase().includes(term))
      const matchedGroups = page.groups.map((group) => {
        const groupTitleMatch = terms.every(term => group.title.toLowerCase().includes(term))
        const matchedMarks = group.marks.filter(mark =>
          groupTitleMatch || isMarkMatch(mark, terms),
        )
        return { ...group, marks: matchedMarks, count: matchedMarks.length }
      }).filter(group => group.marks.length > 0)

      if (pageTitleMatch || matchedGroups.length > 0 || tagNameMatch) {
        matchedPages[url] = pageTitleMatch || tagNameMatch
          ? page
          : { ...page, groups: matchedGroups, totalMarks: matchedGroups.reduce((sum, g) => sum + g.count, 0) }
      }
    }

    if (Object.keys(matchedPages).length > 0) {
      result[tagId] = {
        ...folder,
        pages: matchedPages,
        totalMarks: Object.values(matchedPages).reduce((sum, p) => sum + p.totalMarks, 0),
      }
    }
  }

  return result
}
