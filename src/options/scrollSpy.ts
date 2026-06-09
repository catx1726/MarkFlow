export interface ScrollSpySection {
  id: string
  offsetTop: number
}

/**
 * 根据滚动位置计算当前应该高亮的区块 ID
 *
 * 算法：
 * 1. 如果滚动到接近页面底部（剩余不足 50px），直接返回最后一个区块。
 * 2. 否则从后往前遍历，找到第一个 offsetTop <= scrollY + 20 的区块。
 * 3. 如果没有满足的，返回第一个区块。
 *
 * 20px 的小偏移量确保：
 * - 点击某个区块跳转后，该区块能被正确高亮。
 * - 相邻区块之间不会互相"抢占"高亮状态。
 */
export function getActiveSectionId(
  scrollY: number,
  winHeight: number,
  docHeight: number,
  sections: ScrollSpySection[],
): string {
  if (sections.length === 0)
    return ''

  const nearBottom = scrollY + winHeight >= docHeight - 50
  if (nearBottom) {
    return sections[sections.length - 1].id
  }

  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i].offsetTop <= scrollY + 20) {
      return sections[i].id
    }
  }

  return sections[0].id
}
