/**
 * # 配置常量 (Configuration Constants)
 *
 * 本模块定义扩展的核心配置常量，包括高亮样式、快捷键和清理阈值。
 *
 * ## 常量说明
 *
 * | 常量 | 值 | 用途 |
 * |------|-----|------|
 * | `highlightDefaultStyle(color)` | CSS box-shadow | 高亮标记的视觉样式，默认为黄色下划线 |
 * | `shortcuts.openSidePanel` | `'Alt+S'` | 打开侧边栏的快捷键组合 |
 * | `CLEANUP_DAYS_THRESHOLD` | `30` | 标记清理阈值（天数），超过此天数的未访问标记可能被清理 |
 *
 * ## 高亮样式设计
 * 使用 `box-shadow: inset 0 -5px 0 0` 而非 `background-color` 的原因：
 * - 不遮挡文本原有颜色
 * - 支持半透明效果
 * - 与文本下方的内容保持视觉层次
 *
 * @module config
 */

import { defaultSettings } from './settings'

export function highlightDefaultStyle(color: string | Ref<string> = defaultSettings.defaultHighlightColor, height: number = defaultSettings.highlightHeight) {
  return `box-shadow: inset 0 -${height}px 0 0 ${color}; padding-bottom: ${height}px; cursor: pointer;`
}

// --- Shortcuts ---
export const shortcuts = {
  openSidePanel: 'Alt+S',
}

// --- Cleanup ---
export const CLEANUP_DAYS_THRESHOLD = 30
