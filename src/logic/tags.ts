import type { Tag } from './storage'

/**
 * 过滤掉 allTags 中已不存在的标签 id（防悬空引用）。
 *
 * 用于标签记忆预选：`settings.lastUsedTags` 可能引用了之后被删除的标签，
 * 预选前需以此函数剔除，避免悬空 id 被写入新 mark 的 tags。
 */
export function filterExistingTags(ids: string[], allTags: Tag[]): string[] {
  const existingIds = new Set(allTags.map(t => t.id))
  return ids.filter(id => existingIds.has(id))
}
