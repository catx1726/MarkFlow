/**
 * 提取文本中的关键词。
 * 目前采用基于长度和常见停用词过滤的简单逻辑，后期可升级为 NLP 库。
 */
export function extractKeywords(text: string): string[] {
  if (!text) return []

  // 移除非字母数字的字符，保留空格以便分词
  const cleanText = text.replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
  
  // 分词（按空格和中文标点）
  const words = cleanText.split(/\s+/)
  
  // 过滤：
  // 1. 长度大于 1（避免提取“是”、“的”等单字，除非是重要的专有名词）
  // 2. 排除纯数字
  const keywords = words.filter(word => {
    const isMeaningful = word.length > 1
    const isNotNumeric = isNaN(Number(word))
    return isMeaningful && isNotNumeric
  })

  return Array.from(new Set(keywords)) // 去重
}

interface AssociationStats {
  count: number
  domains: Set<string>
}

/**
 * 判断是否应该将关键词晋升为正式标签。
 * 阈值：域名数量 >= 2 且 标记数量 >= 3
 */
export function shouldPromoteToTag(stats: AssociationStats): boolean {
  return stats.domains.size >= 2 && stats.count >= 3
}
