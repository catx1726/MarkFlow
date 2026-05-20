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
 * 增强版：支持基础的中文 2+ 字符词簇识别。
 */
export function extractKeywords(text: string): string[] {
  if (!text) return []

  const results: string[] = []
  
  // 1. 提取中文词簇 (2个及以上汉字)
  const chineseClusters = text.match(/[\u4e00-\u9fa5]{2,}/g) || []
  results.push(...chineseClusters)

  // 2. 提取英文/数字词
  // 移除非字母数字字符
  const cleanText = text.replace(/[^\w\s]/g, ' ')
  const englishWords = cleanText.split(/\s+/)
  
  const filteredEnglish = englishWords.filter(word => {
    const w = word.toLowerCase()
    return w.length > 2 && isNaN(Number(w)) && !STOP_WORDS.has(w)
  })
  results.push(...filteredEnglish)

  return Array.from(new Set(results))
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

