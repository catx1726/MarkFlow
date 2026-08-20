import { beforeEach, describe, expect, it } from 'vitest'
import { currentLocale, t } from '~/logic/i18n'
import { en } from '~/logic/i18n/locales/en'
import { zhCN } from '~/logic/i18n/locales/zh-CN'
import { settings } from '~/logic/settings'

describe('i18n t()', () => {
  beforeEach(() => {
    settings.value.language = 'auto'
  })

  it('测试环境（无 WebExtension API）auto 回退 zh-CN', () => {
    expect(currentLocale.value).toBe('zh-CN')
    expect(t('common.save')).toBe('保存')
  })

  it('手动切换语言后 t() 返回对应语言', () => {
    settings.value.language = 'en'
    expect(currentLocale.value).toBe('en')
    expect(t('common.save')).toBe('Save')
    settings.value.language = 'zh-CN'
    expect(t('common.save')).toBe('保存')
  })

  it('参数插值替换 {placeholder}', () => {
    settings.value.language = 'zh-CN'
    const zh = t('popup.markCountPrefix') + 5 + t('popup.markCountSuffix')
    expect(zh).toContain('5')
    settings.value.language = 'en'
    expect(t('sidepanel.confirmDeleteTag', { name: 'Books' })).toContain('Books')
  })

  it('未知 key 退化为返回 key 本身', () => {
    expect(t('nonexistent.deep.key')).toBe('nonexistent.deep.key')
  })

  it('en 与 zh-CN 字典结构同构（无缺失/多余 key）', () => {
    const flatten = (obj: Record<string, any>, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : `${prefix}${k}`,
      )
    expect(flatten(en as any).sort()).toEqual(flatten(zhCN as any).sort())
  })

  it('en 字典无空字符串值', () => {
    const walk = (obj: Record<string, any>, path = ''): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        typeof v === 'object' && v !== null
          ? walk(v, `${path}${k}.`)
          : (typeof v !== 'string' || v.trim() === '') ? [`${path}${k}`] : [],
      )
    expect(walk(en as any)).toEqual([])
  })
})
