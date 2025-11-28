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
  rangySerialized: string // Rangy 序列化后的选区字符串
  createdAt: number // 创建时间戳
  title?: string // 网页 tab 名称
}

export const { data: storageDemo, dataReady: storageDemoReady } = useWebExtensionStorage('webext-demo', 'Storage Demo')
