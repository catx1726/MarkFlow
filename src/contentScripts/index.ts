/* eslint-disable no-console */
import { onMessage, sendMessage } from 'webext-bridge/content-script'
import { createApp } from 'vue'
import rangy from 'rangy'

import 'rangy/lib/rangy-classapplier'
import 'rangy/lib/rangy-serializer'
import App from './views/App.vue'
import { setupApp } from '~/logic/common-setup'

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
import { type Mark } from '~/logic/storage'
import { RangySelection } from 'rangy/lib/rangy-core'

// 用于跟踪已成功恢复到页面上的标记，避免重复操作
const restoredMarkIds = new Set<string>()
let debounceTimer: number

function initialize() {
  rangy.init()
  console.info('[vitesse-webext] Hello world from content script')

  // communication example: send previous tab title from background page
  onMessage('tab-prev', ({ data }) => {
    console.log(`[vitesse-webext] Navigate from page "${data.title}"`)
  })

  // mount component to context window
  const container = document.createElement('div')
  container.id = __NAME__
  const root = document.createElement('div')
  const styleEl = document.createElement('link')
  const shadowDOM = container.attachShadow?.({ mode: __DEV__ ? 'open' : 'closed' }) || container
  styleEl.setAttribute('rel', 'stylesheet')
  styleEl.setAttribute('href', browser.runtime.getURL('dist/contentScripts/style.css'))
  shadowDOM.appendChild(styleEl)
  shadowDOM.appendChild(root)
  document.body.appendChild(container)
  const app = createApp(App)
  setupApp(app)
  app.mount(root)

  // 页面加载时，开始恢复高亮
  restoreHighlights()
    .then(() => {
      console.log('restoreHighlights then')

      const hash = window.location.hash
      if (hash.startsWith('#__highlight-mark__')) {
        const markId = hash.substring('#__highlight-mark__'.length)
        console.log('restoreHighlights markId', markId)
        if (markId) {
          setTimeout(() => {
            // 使用一个小的延迟确保高亮渲染和页面布局稳定
            scrollToMark(markId)
            // 清理 URL，避免刷新时再次滚动
            history.replaceState(null, '', window.location.pathname + window.location.search)
          }, 100)
        }
      }
    })
    .catch((error) => {
      console.error('Error during highlight restoration or scrolling:', error)
    })
}

initialize()

window.addEventListener('mouseup', handleTextSelection)

function handleTextSelection(event: MouseEvent) {
  // 延迟一小段时间确保选区稳定
  setTimeout(() => {
    const selection = rangy.getSelection()
    if (selection.isCollapsed) return

    const selectedText = selection.toString().trim()
    if (!selectedText) return

    // 这里可以弹出一个小菜单让用户选择“高亮”或“添加备注”
    // 为了简化，我们直接创建一个高亮
    console.log('Selected text:', selectedText)

    // 接下来是创建高亮和发送数据
    createHighlight(selection)
  }, 100)
}

function createHighlight(selection: RangySelection) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const className = `webext-highlight-${uniqueId}`

  const applier = rangy.createClassApplier(className, {
    elementName: 'mark',
    elementAttributes: {
      style: 'background-color: yellow; cursor: pointer;'
    }
  })

  // 序列化选区，用于之后恢复和取消高亮
  const rangySerialized = rangy.serializeSelection(selection, true)
  const selectedText = selection.toString()

  // 应用高亮
  applier.applyToSelection()

  // 清除用户在屏幕上的选区
  selection.removeAllRanges()

  // 准备要存储的数据
  const markData: Mark = {
    id: uniqueId,
    url: getCanonicalUrlForMark(),
    text: selectedText,
    note: '这是一个测试备注', // 暂时硬编码
    color: 'yellow',
    rangySerialized,
    createdAt: Date.now(),
    title: document.title
  }

  // 通过 webext-bridge 将新标记发送到背景脚本进行存储
  sendMessage('add-mark', markData, 'background')
}

onMessage('goto-mark', ({ data }) => {
  scrollToMark(data.markId)
})

onMessage('remove-mark', ({ data: markToRemove }) => {
  if (!markToRemove || !markToRemove.rangySerialized) return

  const className = `webext-highlight-${markToRemove.id}`
  const applier = rangy.createClassApplier(className, {
    elementName: 'mark'
  })

  try {
    rangy.deserializeSelection(markToRemove.rangySerialized)
    applier.undoToSelection()
    rangy.getSelection().removeAllRanges()
  } catch (e) {
    console.error('Failed to remove highlight via Rangy, falling back to class-based removal.', e)
    // Fallback: 如果反序列化失败 (DOM 变化太大)，直接移除所有相关 class 的元素
    document.querySelectorAll(`.${className}`).forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el)

        parent.removeChild(el)
      }
    })
  }
})

function scrollToMark(markId: string) {
  const className = `webext-highlight-${markId}`
  const element = document.querySelector(`.${className}`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // 可以给目标元素一个短暂的闪烁效果以提示用户
    document.querySelectorAll(`.${className}`).forEach((el) => {
      if (!(el instanceof HTMLElement)) return
      el.style.transition = 'background-color 0.5s ease-in-out'
      el.style.backgroundColor = 'lightgreen'
      setTimeout(() => {
        el.style.backgroundColor = 'yellow' // TODO: 应该恢复为标记的原始颜色
      }, 1000)
    })
  }
}

/**
 * 获取当前页面的规范化 URL，移除哈希和尾部斜杠
 */
function getCanonicalUrlForMark(): string {
  const urlObj = new URL(window.location.href)
  urlObj.hash = ''
  if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) urlObj.pathname = urlObj.pathname.slice(0, -1)

  return urlObj.href
}

/**
 * 恢复高亮的主函数
 */
async function restoreHighlights() {
  // 1. 从背景脚本获取当前 URL 的所有标记
  const canonicalUrl = getCanonicalUrlForMark()
  console.log(`[content-script] Requesting marks for: ${canonicalUrl}`)
  const marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')

  console.log('restoreHighlights', marks)
  if (!marks || marks.length === 0) return

  // 2. 尝试应用这些标记
  const marksToRestore = marks.filter((mark) => !restoredMarkIds.has(mark.id))
  applyMarks(marksToRestore)

  // 3. 设置一个 DOM 变化观察者，以处理动态加载的内容
  const observer = new MutationObserver((mutations) => {
    // 我们只关心节点添加操作
    const hasAddedNodes = mutations.some((m) => m.addedNodes.length > 0)
    if (!hasAddedNodes) return

    // 使用防抖（debounce）来避免在 DOM 快速变化时频繁执行恢复操作
    debouncedRestore()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

/**
 * 防抖函数，用于在 DOM 稳定一小段时间后再次尝试恢复高亮
 */
function debouncedRestore() {
  clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(async () => {
    const canonicalUrl = getCanonicalUrlForMark(),
      marks = await sendMessage('get-marks-for-url', { url: canonicalUrl }, 'background')
    if (!marks) return
    const marksToRestore = marks.filter((mark) => !restoredMarkIds.has(mark.id))
    if (marksToRestore.length > 0) applyMarks(marksToRestore)
  }, 500)
}

/**
 * 遍历并应用标记到页面上
 */
function applyMarks(marks: Mark[]) {
  for (const mark of marks) {
    const className = `webext-highlight-${mark.id}`
    const applier = rangy.createClassApplier(className, {
      elementName: 'mark',
      elementAttributes: { style: `background-color: ${mark.color}; cursor: pointer;` }
    })

    try {
      rangy.deserializeSelection(mark.rangySerialized)
      applier.applyToSelection()
      rangy.getSelection().removeAllRanges()
      // 如果成功，记录下来，不再重复尝试
      restoredMarkIds.add(mark.id)
    } catch (e) {
      // 在动态页面上，部分标记恢复失败是正常现象，MutationObserver 会在后续重试
    }
  }
}
