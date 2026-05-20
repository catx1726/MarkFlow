import type { Mark, Tag } from './storage'

export interface MarkGroup {
  title: string
  level: number
  selector: string
  marks: Mark[]
  count: number
  order: number
}

export interface TagTree {
  [tagId: string]: {
    tagName: string
    pages: Record<string, {
      pageTitle: string
      groups: MarkGroup[]
      totalMarks: number
    }>
  }
}

export function buildTagTree(
  marksByUrl: Record<string, Mark[]>,
  tagsMetadata: Record<string, Tag>,
): TagTree {
  const tree: TagTree = {
    inbox: { tagName: '收集箱 (Inbox)', pages: {} }
  }

  Object.values(tagsMetadata).forEach((tag) => {
    tree[tag.id] = { tagName: tag.name, pages: {} }
  })

  const sortedUrls = Object.entries(marksByUrl)
    .filter(([_, marks]) => marks && marks.length > 0)
    .map(([url, marks]) => ({
      url,
      marks,
      lastActive: Math.max(...marks.map((m) => m.createdAt))
    }))
    .sort((a, b) => b.lastActive - a.lastActive)

  for (const { url, marks } of sortedUrls) {
    const pageTitle = marks[0]?.title || new URL(url).hostname

    for (const mark of marks) {
      const targetTags = mark.tags && mark.tags.length > 0 ? mark.tags : ['inbox']

      for (const tagId of targetTags) {
        const actualTagId = tree[tagId] ? tagId : 'inbox'

        if (!tree[actualTagId].pages[url]) {
          tree[actualTagId].pages[url] = { pageTitle, groups: [], totalMarks: 0 }
        }

        const pageEntry = tree[actualTagId].pages[url]
        pageEntry.totalMarks++

        const contextTitle = mark.contextTitle || '未分类标记'
        const contextLevel = mark.contextLevel || 7
        const contextSelector = mark.contextSelector || 'body'
        const contextOrder = mark.contextOrder ?? -1

        let group = pageEntry.groups.find((g) => g.title === contextTitle)
        if (!group) {
          group = {
            title: contextTitle,
            level: contextLevel,
            selector: contextSelector,
            marks: [],
            count: 0,
            order: contextOrder
          }
          pageEntry.groups.push(group)
        }
        group.marks.push(mark)
      }
    }
  }

  Object.values(tree).forEach((folder) => {
    Object.values(folder.pages).forEach((page) => {
      page.groups.forEach((group) => {
        group.marks.sort((a, b) => {
          if (a.domIndex !== undefined && b.domIndex !== undefined) return a.domIndex - b.domIndex
          return a.createdAt - b.createdAt
        })
        group.count = group.marks.length
      })
      page.groups.sort((a, b) => a.order - b.order)
    })
  })

  return tree
}
