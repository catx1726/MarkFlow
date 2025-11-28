<!-- src/sidepanel/Sidepanel.vue -->
<script setup lang="ts">
import { sendMessage } from 'webext-bridge/popup'
import { type Mark, marksByUrl } from '~/logic/storage'

function getHostname(url: string) {
  return new URL(url).hostname
}

function getNormalizedUrlForTabMatching(url: string | URL): string {
  const urlObj = typeof url === 'string' ? new URL(url) : url
  let path = urlObj.pathname
  // 移除路径末尾的斜杠（根路径 / 除外）
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)

  return urlObj.origin + path
}

function getPageTitle(marks: Mark[]) {
  if (!marks || marks.length === 0) return '未知页面'

  // 默认使用第一个标记的标题作为页面标题
  return marks[0]?.title || getHostname(marks[0]?.url)
}

async function gotoMark(mark: Mark) {
  // A more robust way to find the tab, ignoring query parameters and hash
  const allTabs = await browser.tabs.query({ currentWindow: true }),
    targetUrl = getNormalizedUrlForTabMatching(mark.url)

  let tab = allTabs.find((t) => {
    if (!t.url) return false
    try {
      return getNormalizedUrlForTabMatching(t.url) === targetUrl
    } catch (e) {
      return false
    }
  })

  if (tab?.id) {
    // 如果找到了，激活它并发送消息
    await browser.tabs.update(tab.id, { active: true })
    sendMessage('goto-mark', { markId: mark.id }, { context: 'content-script', tabId: tab.id })
  } else {
    // 如果找不到，新建一个 Tab 并用 hash 传递要跳转的标记 ID
    const urlWithHash = new URL(mark.url)

    urlWithHash.hash = `__highlight-mark__${mark.id}`

    tab = await browser.tabs.create({ url: urlWithHash.href, active: true })
  }

  if (!tab?.id) {
    console.error('无法创建或找到 Tab。')
    return
  }
}

async function removeMark(mark: Mark) {
  await sendMessage('remove-mark', mark, 'background')

  // Also use the robust tab finding logic for removing marks from the page
  const allTabs = await browser.tabs.query({ currentWindow: true }),
    targetUrl = getNormalizedUrlForTabMatching(mark.url)

  const tab = allTabs.find((t) => {
    if (!t.url) return false
    try {
      return getNormalizedUrlForTabMatching(t.url) === targetUrl
    } catch (e) {
      return false
    }
  })
  if (tab?.id) sendMessage('remove-mark', mark, { context: 'content-script', tabId: tab.id })
}
</script>

<template>
  <main class="px-4 py-5 text-center text-gray-700">
    <Logo />
    <div>标记管理</div>
    <div class="mt-4 text-left">
      <div v-if="Object.keys(marksByUrl).length === 0" class="text-gray-500 text-center">还没有任何标记</div>
      <div v-else>
        <div v-for="[url, urlMarks] in Object.entries(marksByUrl)" :key="url" class="mb-4">
          <h2 class="text-lg font-semibold border-b pb-1 mb-2" :title="url">
            {{ getPageTitle(urlMarks) }}
          </h2>
          <ul>
            <li v-for="mark in urlMarks" :key="mark.id" class="p-2 my-1 border rounded">
              <div class="cursor-pointer hover:bg-gray-100 p-2 rounded" @click="gotoMark(mark)">
                <p class="font-bold">
                  {{ mark.text }}
                </p>
                <p class="text-sm text-gray-600">{{ mark.note }}</p>
              </div>
              <button class="text-red-500 text-xs mt-1 px-2" @click="removeMark(mark)">删除</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </main>
</template>
