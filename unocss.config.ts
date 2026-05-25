import { defineConfig } from 'unocss/vite'
import { presetAttributify, presetIcons, presetUno, transformerDirectives } from 'unocss'

export default defineConfig({
  presets: [
    presetUno({
      unitResolver: (value: any) => {
        // 如果值是数字，则返回其 px 形式，避免默认的 rem 转换
        if (typeof value === 'number') {
          return `${value}px`
        }
        return value
      },
    }),
    presetAttributify(),
    presetIcons(),
  ],
  transformers: [transformerDirectives()],

  postprocess: (util) => {
    util.entries.forEach((i) => {
      const value = i[1]
      if (typeof value === 'string' && value.endsWith('rem')) {
        const num = Number.parseFloat(value)
        if (!Number.isNaN(num)) {
          i[1] = `${num * 16}px`
        }
      }
    })
  },

  theme: {
    colors: {
      'brand': {
        'blue': '#4285f4',
        'blue-dark': '#357ae8',
        'red': '#ea4335',
        'red-dark': '#e03324',
      },
      'border-color': '#dadce0',
    },
  },
})
