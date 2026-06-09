import { describe, expect, it } from 'vitest'
import { type ScrollSpySection, getActiveSectionId } from '../scrollSpy'

function makeSections(offsetTops: number[]): ScrollSpySection[] {
  return offsetTops.map((offsetTop, i) => ({
    id: String.fromCharCode(65 + i), // A, B, C, ...
    offsetTop,
  }))
}

describe('getActiveSectionId', () => {
  const defaultWin = 800
  const defaultDoc = 2000

  it('空数组返回空字符串', () => {
    expect(getActiveSectionId(0, defaultWin, defaultDoc, [])).toBe('')
  })

  it('单个区块：任何滚动位置都返回该区块', () => {
    const sections = makeSections([100])
    expect(getActiveSectionId(0, defaultWin, defaultDoc, sections)).toBe('A')
    expect(getActiveSectionId(50, defaultWin, defaultDoc, sections)).toBe('A')
    expect(getActiveSectionId(200, defaultWin, defaultDoc, sections)).toBe('A')
  })

  it('滚动在第一个区块上方时返回第一个区块', () => {
    const sections = makeSections([100, 200, 300])
    // scrollY=0, A=100 > 20, B=200 > 20, C=300 > 20 → 返回 A（兜底）
    expect(getActiveSectionId(0, defaultWin, defaultDoc, sections)).toBe('A')
  })

  it('滚动到 A 顶部时高亮 A', () => {
    const sections = makeSections([100, 200, 300])
    // scrollY=100, A=100 <= 120 → A
    expect(getActiveSectionId(100, defaultWin, defaultDoc, sections)).toBe('A')
  })

  it('滚动到 A 和 B 之间时高亮 A', () => {
    const sections = makeSections([100, 200, 300])
    // scrollY=150, A=100 <= 170 → A (B=200 > 170)
    expect(getActiveSectionId(150, defaultWin, defaultDoc, sections)).toBe('A')
  })

  it('滚动到 B 顶部时高亮 B', () => {
    const sections = makeSections([100, 200, 300])
    // scrollY=200, A=100 <= 220, B=200 <= 220 → 从后往前先遇到 B
    expect(getActiveSectionId(200, defaultWin, defaultDoc, sections)).toBe('B')
  })

  it('滚动到 C 顶部时高亮 C', () => {
    const sections = makeSections([100, 200, 300])
    expect(getActiveSectionId(300, defaultWin, defaultDoc, sections)).toBe('C')
  })

  it('滚动超过最后一个区块仍然返回最后一个', () => {
    const sections = makeSections([100, 200, 300])
    expect(getActiveSectionId(500, defaultWin, defaultDoc, sections)).toBe('C')
  })

  /**
   * 核心回归测试：用户反馈的 bug
   * 当有 A B C D E F 六个区块时，选择了 F 之后，D 和 E 仍然应该可以被正确高亮。
   *
   * 旧的从后往前遍历 + 120px 偏移算法会导致：
   * 当 F.offsetTop = 500, E.offsetTop = 400, scrollY = 400 时，
   * scrollPos = 520, F=500 <= 520 → 错误地选中 F 而不是 E。
   *
   * 新的 20px 偏移可以正确避免这个问题。
   */
  describe('回归：A B C D E F 六区块场景', () => {
    const sections = makeSections([0, 100, 200, 300, 400, 500])

    it.each([
      { scrollY: 0, expected: 'A', desc: '在顶部' },
      { scrollY: 50, expected: 'A', desc: 'A 中间' },
      { scrollY: 100, expected: 'B', desc: 'B 顶部' },
      { scrollY: 150, expected: 'B', desc: 'B 中间' },
      { scrollY: 200, expected: 'C', desc: 'C 顶部' },
      { scrollY: 250, expected: 'C', desc: 'C 中间' },
      { scrollY: 300, expected: 'D', desc: 'D 顶部' },
      { scrollY: 350, expected: 'D', desc: 'D 中间' },
      { scrollY: 400, expected: 'E', desc: 'E 顶部' },
      { scrollY: 450, expected: 'E', desc: 'E 中间' },
      { scrollY: 500, expected: 'F', desc: 'F 顶部' },
      { scrollY: 550, expected: 'F', desc: 'F 中间' },
      { scrollY: 800, expected: 'F', desc: '超过底部' },
    ])('$desc (scrollY=$scrollY) → $expected', ({ scrollY, expected }) => {
      expect(getActiveSectionId(scrollY, defaultWin, defaultDoc, sections)).toBe(expected)
    })
  })

  /**
   * 紧密排列场景：区块之间间距很小（< 20px）
   * 确保即使间距很小，算法仍然能正确区分相邻区块。
   */
  describe('紧密排列场景', () => {
    const sections = makeSections([0, 30, 60, 90, 120, 150])

    it.each([
      { scrollY: 0, expected: 'A' },
      { scrollY: 30, expected: 'B' },
      { scrollY: 60, expected: 'C' },
      { scrollY: 90, expected: 'D' },
      { scrollY: 120, expected: 'E' },
      { scrollY: 150, expected: 'F' },
    ])('scrollY=$scrollY → $expected', ({ scrollY, expected }) => {
      expect(getActiveSectionId(scrollY, defaultWin, defaultDoc, sections)).toBe(expected)
    })
  })

  /**
   * 底部场景：最后一个区块很短，在页面底部
   * 确保滚动到页面底部时，即使最后一个区块的 offsetTop 远大于 scrollY + 20，
   * 仍然能正确高亮最后一个区块。
   */
  describe('底部短区块场景', () => {
    const sections = makeSections([0, 200, 400])

    it('滚动到页面底部时选中最后一个', () => {
      // winHeight=500, docHeight=600, scrollY=100
      // nearBottom = 100 + 500 >= 600 - 50 = 550 → true
      expect(getActiveSectionId(100, 500, 600, sections)).toBe('C')
    })

    it('页面无需滚动时（所有内容在视口内）选中最后一个', () => {
      // winHeight=800, docHeight=500, scrollY=0
      // nearBottom = 0 + 800 >= 500 - 50 = 450 → true
      expect(getActiveSectionId(0, 800, 500, sections)).toBe('C')
    })

    it('正常滚动到 C 顶部（未到底部）', () => {
      // scrollY=400, C=400 <= 420 → C
      expect(getActiveSectionId(400, defaultWin, defaultDoc, sections)).toBe('C')
    })
  })
})
