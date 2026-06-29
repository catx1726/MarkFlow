import type { Mark, SyncConfig, SyncStatus, Tag } from './storage'

export interface SyncData {
  marks: Record<string, Mark[]>
  tags: Record<string, Tag>
  lastSync: number
}

export interface GistFile {
  content: string
}

export interface GistResponse {
  id: string
  files: Record<string, GistFile>
}

/**
 * 合并标记数据，基于 id 匹配，保留 createdAt 较大的版本
 */
export function mergeMarks(local: Record<string, Mark[]>, remote: Record<string, Mark[]>): Record<string, Mark[]> {
  const result = { ...local }
  for (const [url, remoteMarks] of Object.entries(remote)) {
    if (!result[url]) {
      result[url] = remoteMarks
      continue
    }
    const localMarksMap = new Map(result[url].map(m => [m.id, m]))
    remoteMarks.forEach((rm) => {
      const lm = localMarksMap.get(rm.id)
      if (!lm) {
        localMarksMap.set(rm.id, rm)
      }
      else {
        // 比较两者的最后更新时间（可能是创建时间或删除时间）
        const localTime = Math.max(lm.createdAt, lm.deletedAt || 0)
        const remoteTime = Math.max(rm.createdAt, rm.deletedAt || 0)
        if (remoteTime > localTime) {
          localMarksMap.set(rm.id, rm)
        }
      }
    })
    result[url] = Array.from(localMarksMap.values())
  }

  return result
}

/**
 * 合并标签元数据
 */
export function mergeTags(local: Record<string, Tag>, remote: Record<string, Tag>): Record<string, Tag> {
  const result = { ...local }
  for (const [id, rt] of Object.entries(remote)) {
    const lt = result[id]
    if (!lt || rt.createdAt > lt.createdAt) {
      result[id] = rt
    }
  }
  return result
}

/**
 * 判断当前状态是否允许执行推送
 */
export function canPush(config: SyncConfig, status: SyncStatus): boolean {
  return config.enabled
    && !!config.token
    && !!config.gistId
    && status.lastSyncStatus === 'success'
}

/**
 * 解析远程 Gist 文件内容并合并到本地数据
 */
export function mergeWithRemoteFile(
  localMarks: Record<string, Mark[]>,
  localTags: Record<string, Tag>,
  fileContent: string | undefined,
): { marks: Record<string, Mark[]>, tags: Record<string, Tag> } {
  if (!fileContent?.trim()) {
    return { marks: localMarks, tags: localTags }
  }
  const remoteData = JSON.parse(fileContent) as Partial<SyncData>
  return {
    marks: mergeMarks(localMarks, remoteData.marks || {}),
    tags: mergeTags(localTags, remoteData.tags || {}),
  }
}

/**
 * 获取用户的 Gists 列表，支持分页直到找到目标 Gist 或没有更多数据
 *
 * 注意：列表接口返回的 Gist 文件对象不包含 content，需要读取内容时请用 getGistById。
 */
export async function getGists(token: string, targetGistId?: string): Promise<GistResponse[]> {
  const perPage = 100
  let page = 1
  const allGists: GistResponse[] = []

  while (true) {
    const res = await fetch(`https://api.github.com/gists?per_page=${perPage}&page=${page}`, {
      headers: { Authorization: `token ${token}` },
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403)
        throw new Error('身份验证失败或权限不足，请检查 Token 配置')
      throw new Error(`GitHub API 请求失败: ${res.status}`)
    }

    const gists: GistResponse[] = await res.json()
    allGists.push(...gists)

    if (targetGistId && gists.some(g => g.id === targetGistId))
      return allGists

    if (gists.length < perPage)
      return allGists

    page++
  }
}

/**
 * 根据 ID 获取单个 Gist，包含完整的文件内容
 */
export async function getGistById(token: string, gistId: string): Promise<GistResponse> {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Authorization: `token ${token}` },
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error('身份验证失败或权限不足，请检查 Token 配置')
    if (res.status === 404)
      throw new Error('未找到指定的同步 Gist，请检查 Gist ID')
    throw new Error(`GitHub API 请求失败: ${res.status}`)
  }
  return res.json()
}

/**
 * 创建新的 Gist
 */
export async function createGist(token: string, data: SyncData): Promise<GistResponse> {
  const res = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: { Authorization: `token ${token}` },
    body: JSON.stringify({
      description: 'Highlight-Mark-Flow Sync Data',
      public: false,
      files: { 'markflow_sync.json': { content: JSON.stringify(data) } },
    }),
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error('身份验证失败或权限不足，请检查 Token 配置')
    throw new Error(`请求失败: ${res.status}`)
  }
  return res.json()
}

/**
 * 更新现有 Gist
 */
export async function updateGist(token: string, gistId: string, data: SyncData): Promise<boolean> {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: { Authorization: `token ${token}` },
    body: JSON.stringify({
      files: { 'markflow_sync.json': { content: JSON.stringify(data) } },
    }),
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new Error('身份验证失败或权限不足，请检查 Token 配置')
    throw new Error(`请求失败: ${res.status}`)
  }
  return res.ok
}
