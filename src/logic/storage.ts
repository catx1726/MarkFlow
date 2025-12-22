import { useWebExtensionStorage } from '~/composables/useWebExtensionStorage'

export const { data: marksByUrl, dataReady } = useWebExtensionStorage<Record<string, Mark[]>>(
  'marks-by-url-storage',
  {}
)

export interface Mark {
  id: string // 唯一ID
  url: string // 标记所在的页面URL
  text: string // 高亮的文本内容
  note: string // 备注
  color: string // 高亮颜色
  html?: string // 新增：高亮内容的 HTML 格式
  rangySerialized: string // Rangy 序列化后的选区字符串
  shadowHostSelector?: string // 新增：如果高亮在 Shadow DOM 中，则存储其宿主元素的选择器
  createdAt: number // 创建时间戳
  title?: string // 网页 tab 名称
  // 结构化回顾新增字段
  contextTitle?: string // 最近的上级标题文本
  contextSelector?: string // 最近的上级标题的 CSS 选择器
  contextLevel?: number // 最近的上级标题级别 (h1=1, h6=6)
  contextOrder?: number // 新增：标题在文档中的顺序索引
}

export interface UpdateMarkNotePayload {
  url: string
  id: Mark['id'] // 使用 Mark 接口中的 id 类型
  note: string
  color: string

  [key: string]: any // 允许对象拥有任何 string 类型的键
}

export interface RemoveMarkPayload {
  url: string
  id: Mark['id']
  [key: string]: any // 添加索引签名
}

export interface GetMarkByIdPayload {
  url: string
  id: Mark['id']

  [key: string]: any // 添加索引签名
}
