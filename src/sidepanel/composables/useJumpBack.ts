import { onMounted, onUnmounted, ref } from 'vue'
import { sendMessage } from 'webext-bridge/options'
import browser from 'webextension-polyfill'

/**
 * 跳转历史回退：查询/驱动当前活动标签页的跳转栈（content script 内存态，多级）。
 * 栈的真实数据源在 content script（页面坐标无法脱离页面存在），此处仅持有深度镜像。
 */
export function useJumpBack() {
  const depth = ref(0)

  async function getActiveTabId(): Promise<number | undefined> {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    return tab?.id
  }

  async function refreshDepth() {
    const tabId = await getActiveTabId()
    if (!tabId) {
      depth.value = 0
      return
    }
    try {
      const res = await sendMessage('get-jump-history-depth', undefined, { context: 'content-script', tabId })
      depth.value = res.depth
    }
    catch {
      // content script 未注入的页面（设置页/商店页等）不可达，视为无历史
      depth.value = 0
    }
  }

  async function jumpBack() {
    const tabId = await getActiveTabId()
    if (!tabId)
      return
    try {
      const res = await sendMessage('jump-back', undefined, { context: 'content-script', tabId })
      depth.value = res.depth
    }
    catch {
      depth.value = 0
    }
  }

  function handleTabActivated() {
    refreshDepth()
  }

  onMounted(() => {
    refreshDepth()
    browser.tabs.onActivated.addListener(handleTabActivated)
  })

  onUnmounted(() => {
    browser.tabs.onActivated.removeListener(handleTabActivated)
  })

  return {
    depth,
    jumpBack,
    refreshDepth,
  }
}
