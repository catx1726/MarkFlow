import { describe, expect, it } from 'vitest'

// 模拟 Mark 接口
interface Mark {
  id: string
  createdAt: number
  domIndex?: number
  contextOrder?: number
}

// 模拟排序逻辑函数
function sortMarks(marks: Mark[]) {
  return [...marks].sort((a, b) => {
    if (a.domIndex !== undefined && b.domIndex !== undefined)
      return a.domIndex - b.domIndex
    return a.createdAt - b.createdAt
  })
}

function sortUrls(urlMarks: Record<string, Mark[]>) {
  return Object.entries(urlMarks)
    .filter(([_, marks]) => marks && marks.length > 0)
    .map(([url, marks]) => ({
      url,
      lastActive: Math.max(...marks.map(m => m.createdAt)),
    }))
    .sort((a, b) => b.lastActive - a.lastActive)
}

describe('排序逻辑验证', () => {
  it('标记应按 domIndex 升序排列 (阅读顺序)', () => {
    const marks: Mark[] = [
      { id: '2', createdAt: 200, domIndex: 500 }, // 后添加，但在文中更靠前
      { id: '1', createdAt: 100, domIndex: 1000 }, // 先添加，但在文中更靠后
    ]

    const sorted = sortMarks(marks)
    expect(sorted[0].id).toBe('2')
    expect(sorted[1].id).toBe('1')
  })

  it('旧数据应退回到按 createdAt 排序', () => {
    const marks: Mark[] = [
      { id: '1', createdAt: 100 },
      { id: '2', createdAt: 200 },
    ]

    const sorted = sortMarks(marks)
    expect(sorted[0].id).toBe('1')
    expect(sorted[1].id).toBe('2')
  })

  it('网页应按最新活跃时间降序排列', () => {
    const urlMarks: Record<string, Mark[]> = {
      'old-page': [{ id: 'o1', createdAt: 1000 }],
      'new-page': [{ id: 'n1', createdAt: 5000 }], // 这个网页有更新的标记
    }

    const sorted = sortUrls(urlMarks)
    expect(sorted[0].url).toBe('new-page')
    expect(sorted[1].url).toBe('old-page')
  })

  it('混合排序：网页活跃度应动态变化', () => {
    const urlMarks: Record<string, Mark[]> = {
      'page-a': [{ id: 'a1', createdAt: 1000 }],
      'page-b': [{ id: 'b1', createdAt: 2000 }],
    }

    let sorted = sortUrls(urlMarks)
    expect(sorted[0].url).toBe('page-b')

    // 模拟在 page-a 新增了一个标记
    urlMarks['page-a'].push({ id: 'a2', createdAt: 3000 })

    sorted = sortUrls(urlMarks)
    expect(sorted[0].url).toBe('page-a')
  })
})
