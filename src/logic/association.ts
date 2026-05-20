// 基础停用词表（后续可扩展）
const STOP_WORDS = new Set([
  // 英文常见词
  'the', 'this', 'that', 'have', 'with', 'what', 'your', 'from', 'they', 'their', 'them', 'been', 'were',
  'will', 'would', 'should', 'could', 'some', 'other', 'than', 'then', 'more', 'about', 'only', 'such',
  'just', 'than', 'into', 'over', 'also', 'back', 'much', 'well', 'thru', 'very', 'here', 'when', 'where',
  'there', 'even', 'does', 'did', 'make', 'made', 'went', 'went', 'came', 'down', 'upon', 'then', 'than',
  'each', 'much', 'before', 'once', 'after', 'again', 'many', 'most', 'such', 'well', 'very', 'than',
  // 中文常见连词、介词等
  '这个', '那个', '一个', '一些', '这样', '那样', '如果', '但是', '而且', '因为', '所以', '虽然', '但是',
  '这些', '那些', '这种', '那种', '进行', '已经', '可以', '可能', '应该', '如果', '然后', '最后', '由于',
  '对于', '关于', '所谓', '作为', '或者', '还是', '甚至', '尽管', '既然', '以此', '不仅', '而且', '就是'
])

/**
 * 提取文本中的关键词。
 */
export function extractKeywords(text: string): string[] {
  if (!text) return []

  // 移除非字母数字的字符，保留空格以便分词
  const cleanText = text.replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')

  // 分词
  const words = cleanText.split(/\s+/)

  // 过滤逻辑
  const keywords = words.filter(word => {
    const w = word.toLowerCase()
    const isMeaningful = w.length > 1
    const isNotNumeric = isNaN(Number(w))
    const isNotStopWord = !STOP_WORDS.has(w)
    return isMeaningful && isNotNumeric && isNotStopWord
  })

  return Array.from(new Set(keywords))
}

interface AssociationStats {
  count: number
  domains: Set<string>
}

/**
 * 判断是否应该将关键词晋升为正式标签。
 * 阈值（与 Spec 保持一致）：域名数量 >= 2 且 标记数量 >= 3
 */
export function shouldPromoteToTag(stats: AssociationStats): boolean {
  return stats.domains.size >= 2 && stats.count >= 3
}

