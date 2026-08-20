import type { Mark, SyncConfig, SyncStatus, Tag } from './storage'
import { t } from '~/logic/i18n'

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
    && status.lastSyncStatus !== 'none'
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
  try {
    const remoteData = JSON.parse(fileContent) as Partial<SyncData>
    return {
      marks: mergeMarks(localMarks, remoteData.marks || {}),
      tags: mergeTags(localTags, remoteData.tags || {}),
    }
  }
  catch (error: any) {
    console.error('[Sync] Failed to parse remote file content:', error)
    return { marks: localMarks, tags: localTags }
  }
}

/**
 * GitHub API 错误类型，用于驱动上层（main.ts）的差异化处理。
 * - `auth`: 真实认证/权限失败（401，或非速率限制的 403）→ 可自动禁用同步
 * - `rate-limit`: 速率限制/滥用检测 → 不应禁用，遵守 Retry-After 退避
 * - `not-found`: 资源不存在（404）
 * - `storage-limit`: Gist 容量上限（422）
 * - `unknown`: 其他服务端错误
 */
export type GitHubErrorKind = 'auth' | 'rate-limit' | 'not-found' | 'storage-limit' | 'unknown'

export class GitHubAPIError extends Error {
  readonly status: number
  readonly kind: GitHubErrorKind
  readonly retryAfter?: number
  constructor(status: number, kind: GitHubErrorKind, message: string, retryAfter?: number) {
    super(message)
    this.name = 'GitHubAPIError'
    this.status = status
    this.kind = kind
    this.retryAfter = retryAfter
  }
}

const RATE_LIMIT_PATTERN = /rate limit|secondary rate|abuse|too many requests/i

/**
 * 纯函数：根据 GitHub 响应的 status / headers / body 分类错误。
 * 与 `classifyResponse` 分离以便单元测试，无需 mock fetch。
 */
export function classifyGitHubResponse(
  status: number,
  headers: { get: (name: string) => string | null },
  apiMessage: string,
  notFoundMessage: string,
): GitHubAPIError {
  if (status === 422)
    return new GitHubAPIError(status, 'storage-limit', t('sync.errorStorageLimit'))

  if (status === 404)
    return new GitHubAPIError(status, 'not-found', notFoundMessage)

  if (status === 401)
    return new GitHubAPIError(status, 'auth', t('sync.errorAuth'))

  if (status === 403) {
    const remaining = headers.get('X-RateLimit-Remaining')
    const retryAfterRaw = headers.get('Retry-After')
    const retryAfter = retryAfterRaw ? (Number(retryAfterRaw) || undefined) : undefined
    // 主速率限制（剩余配额为 0）或次级滥用检测（body 含特定关键词）
    const isRateLimit = remaining === '0' || RATE_LIMIT_PATTERN.test(apiMessage)
    if (isRateLimit) {
      const hint = retryAfter ? t('sync.rateLimitRetryIn', { seconds: retryAfter }) : t('sync.rateLimitRetryLater')
      return new GitHubAPIError(
        status,
        'rate-limit',
        t('sync.rateLimited', { hint }),
        retryAfter,
      )
    }
    // 其他 403：保守按认证/权限类处理（可能是 token scope 不足或资源受限）
    return new GitHubAPIError(status, 'auth', t('sync.errorForbidden', { message: apiMessage || t('sync.unknownForbiddenReason') }))
  }

  return new GitHubAPIError(status, 'unknown', t('sync.errorApiFailed', { status }) + (apiMessage ? t('sync.errorApiDetail', { message: apiMessage }) : ''))
}

/**
 * 读取 Response 并抛出分类后的 GitHubAPIError。
 * 返回类型为 `never`，调用处可当作 throw 使用。
 */
async function classifyResponse(res: Response, notFoundMessage: string): Promise<never> {
  let apiMessage = ''
  try {
    const body = await res.json()
    if (body && typeof body.message === 'string')
      apiMessage = body.message
  }
  catch {
    // 响应体非 JSON 或为空，忽略
  }
  throw classifyGitHubResponse(res.status, res.headers, apiMessage, notFoundMessage)
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
    if (!res.ok)
      await classifyResponse(res, t('sync.gistNotFound'))

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
  if (!res.ok)
    await classifyResponse(res, t('sync.gistNotFound'))
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
  if (!res.ok)
    await classifyResponse(res, t('sync.createGistFailed'))
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
  if (!res.ok)
    await classifyResponse(res, t('sync.gistNotFound'))
  return res.ok
}
