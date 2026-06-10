import { describe, expect, it } from 'vitest'
import { findCandidateElements } from '../logic/search'
import { calculateSimilarity } from '../logic/dom'
import type { Mark } from '../logic/storage'

describe('li deletion scenario from detail.md', () => {
  it('should handle deletion of first li when mark spans three lis', () => {
    document.body.innerHTML = `
      <h2>核心流程</h2>
      <ol>
        <li><strong>指纹采样</strong>: 高亮创建时，提取多个特征锚点，记录其相对于高亮中心的物理位移。</li>
        <li><strong>共识搜索</strong>: 即使部分内容消失，只要有足够比例的锚点达成"空间位置共识"，系统即可锁定高亮区域（簇心）。</li>
        <li><strong>结果对齐</strong>: 算法选择综合得分最高的片段作为高亮。即便中间文字被删减，系统也能智能逼近最优边界。</li>
      </ol>
      <h2>四级恢复架构</h2>
    `

    const markText = '指纹采样: 高亮创建时，提取多个特征锚点，记录其相对于高亮中心的物理位移。共识搜索: 即使部分内容消失，只要有足够比例的锚点达成"空间位置共识"，系统即可锁定高亮区域（簇心）。结果对齐: 算法选择综合得分最高的片段作为高亮。即便中间文字被删减，系统也能智能逼近最优边界。'
    
    const surroundingSnippet = '核心流程指纹采样: 高亮创建时，提取多个特征锚点，记录其相对于高亮中心的物理位移。共识搜索: 即使部分内容消失，只要有足够比例的锚点达成"空间位置共识"，系统即可锁定高亮区域（簇心）。结果对齐: 算法选择综合得分最高的片段作为高亮。即便中间文字被删减，系统也能智能逼近最优边界。四级恢复架构'

    const mark = {
      id: 'li-test',
      text: markText,
      surroundingSnippet,
    } as Mark

    const ol = document.querySelector('ol')!
    ol.removeChild(ol.children[0])

    const result = findCandidateElements(mark, document.body, 10)
    console.log('ambiguityLevel:', result.ambiguityLevel)
    console.log('candidates count:', result.candidates.length)
    if (result.candidates.length > 0) {
      const c = result.candidates[0]
      console.log('candidate similarityScore:', c.similarityScore)
      console.log('candidate surroundingSnippet:', c.surroundingSnippet.substring(0, 80))
      const ctxSim = calculateSimilarity(c.surroundingSnippet, mark.surroundingSnippet || '')
      console.log('context similarity:', ctxSim)
    }

    expect(result.candidates.length).toBeGreaterThan(0)
  })
})
