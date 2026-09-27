/**
 * 内置 ffmpeg 定位（L1 引擎，产品无关）
 *
 * Playwright 录屏组件装在项目内（PLAYWRIGHT_BROWSERS_PATH='0'，须在 require 前设置），
 * 裁剪版 ffmpeg 位于 node_modules/playwright-core/.local-browsers/ 下以 ffmpeg- 开头的目录。
 * 能力清单见 SKILL 坑 #5：只有 matroska demuxer / webm muxer / png encoder /
 * image2 muxer / libvpx / scale,crop,pad filter。
 */
import fs from 'node:fs'
import path from 'node:path'

/** 返回项目内 Playwright 捆绑 ffmpeg 的绝对路径；未安装则抛错 */
export function findBundledFfmpeg(rootDir) {
  const dir = path.join(rootDir, 'node_modules/playwright-core/.local-browsers')
  const d = fs.readdirSync(dir).find(d => d.startsWith('ffmpeg-'))
  if (!d) throw new Error('内置 ffmpeg 未安装：npx playwright install ffmpeg')
  return path.join(dir, d, 'ffmpeg-mac')
}
