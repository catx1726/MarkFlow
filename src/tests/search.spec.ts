import { beforeEach, describe, expect, it } from 'vitest'
import { findCandidateElements, invalidateSearchContextCache } from '../logic/search'
import { getAllTextNodes } from '../logic/dom'
import type { Mark } from '../logic/storage'

describe('search logic - recursive traversal', () => {
  beforeEach(() => {
    // SearchContext 为 pass 级缓存（root 引用 + 版本号），直接调用方需自行失效
    invalidateSearchContextCache()
  })

  it('should find text in simple DOM', () => {
    document.body.innerHTML = '<div>Hello World</div>'
    const mark = { text: 'Hello' } as Mark
    const result = findCandidateElements(mark, document.body, 10)

    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.candidates[0].displayTextSnippet).toBe('Hello')
  })

  it('should find text inside Shadow DOM', () => {
    document.body.innerHTML = '<div id="host"></div>'
    const host = document.getElementById('host')!
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = '<span>Shadow Text</span>'

    const mark = { text: 'Shadow' } as Mark
    const result = findCandidateElements(mark, document.body, 10)

    expect(result.candidates.length).toBe(1)
    expect(result.candidates[0].displayTextSnippet).toBe('Shadow')
  })

  it('should find text spanning multiple text nodes', () => {
    document.body.innerHTML = '<div><span>Hello </span>World</div>'
    const mark = { text: 'Hello World' } as Mark
    const result = findCandidateElements(mark, document.body, 10)

    expect(result.candidates.length).toBe(1)
    expect(result.candidates[0].displayTextSnippet).toBe('Hello World')
  })

  // Level 3 consensus (fuzzy matching) is temporarily disabled.
  it.skip('should find unique candidate even if text has minor changes (fuzzy)', () => {
    // 构造一个受控的上下文
    // 前缀(20字): "12345678901234567890"
    // 文本: "amazing world" -> "amazzing world"
    // 后缀(20字): "09876543210987654321"
    const prefix = '12345678901234567890'
    const suffix = '09876543210987654321'

    document.body.innerHTML = `<div>${prefix}amazzing world${suffix}</div>`

    const mark = {
      id: 'test-id',
      text: 'amazing world',
      surroundingSnippet: `${prefix}amazing world${suffix}`,
    } as Mark

    const result = findCandidateElements(mark, document.body, 10)

    expect(result.ambiguityLevel).toBe('unique')
    expect(result.candidates.length).toBe(1)
    expect(result.candidates[0].similarityScore).toBeGreaterThan(85)
    // 夹逼算法应该精准提取出目标区域的内容
    expect(result.candidates[0].displayTextSnippet).toContain('mazzing world')
  })

  it('should extract text across multiple block elements', () => {
    document.body.innerHTML = '<div id="test"><p>Hello </p><p>World</p></div>'
    const nodes = getAllTextNodes(document.getElementById('test')!)
    const fullText = nodes.map((n: Text) => n.textContent).join('')
    expect(fullText).toBe('Hello World')
  })

  describe('searchContext 缓存失效必要性（PR #92 CR2 Blocking #2 对照实验）', () => {
    it('高亮替换文本节点后：不失效的缓存导致运行时异常，失效后正常', () => {
      // 场景：成功应用高亮后，p 内文本全部被 span 包裹——旧 Text 节点
      // 脱离 DOM，span 内是新节点（Rangy applier 的真实 DOM 形态）
      document.body.innerHTML = '<div id="c"><p>target text</p><p>other content</p></div>'
      const mark = { id: 'm1', text: 'target' } as Mark

      // 首次搜索：建立缓存
      expect(findCandidateElements(mark, document.body).candidates.length).toBe(1)

      // 模拟高亮成功应用：旧文本节点被移除出 DOM
      const p = document.querySelector('p')!
      p.innerHTML = '<span class="webext-highlight-m2">target text</span>'

      // 不失效（命中脏缓存）：脱离 DOM 的旧节点使后续节点定位失败。
      // 宽松断言（不锁异常类型）：任何异常或空候选都证明脏缓存不可用
      // ——这正是"高亮应用后必须失效"的必要性依据（PR #92 CR3 Nit 5）
      let staleBroken = false
      try {
        const stale = findCandidateElements(mark, document.body)
        staleBroken = stale.candidates.length === 0
      }
      catch {
        staleBroken = true
      }
      expect(staleBroken).toBe(true)

      // 失效重建：恢复正常
      invalidateSearchContextCache()
      expect(findCandidateElements(mark, document.body).candidates.length).toBe(1)
    })
  })
})
