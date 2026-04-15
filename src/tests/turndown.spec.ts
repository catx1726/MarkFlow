import { describe, expect, it } from 'vitest'
import TurndownService from 'turndown'

describe('turndown service', () => {
  it('should convert HTML to Markdown', () => {
    const turndownService = new TurndownService()
    const html = '<b>Bold</b> and <i>italic</i>'
    const markdown = turndownService.turndown(html)
    expect(markdown).toBe('**Bold** and _italic_')
  })

  it('should handle strikethrough with custom rule', () => {
    const turndownService = new TurndownService()
    turndownService.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: (content) => `~~${content}~~`,
    })
    const html = '<strike>deleted</strike>'
    const markdown = turndownService.turndown(html)
    expect(markdown).toBe('~~deleted~~')
  })
})
