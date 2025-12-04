<script setup lang="ts">
import { computed } from 'vue'
import { sendMessage } from 'webext-bridge/popup'
import { marksByUrl } from '~/logic/storage'

const totalMarks = computed(() => {
  return Object.values(marksByUrl.value).flat().length
})

function openOptionsPage() {
  browser.runtime.openOptionsPage()
  window.close()
}

async function openSidePanel() {
  try {
    // For Firefox, sidebarAction.open() must be called from a user-input handler.
    // The popup's context is such a handler.
    if (browser.sidebarAction && typeof browser.sidebarAction.open === 'function') {
      await browser.sidebarAction.open()
    } else {
      // For Chrome, we still need to message the background script
      // because sidePanel.open() needs a tabId.
      const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true })
      await sendMessage('open-sidepanel', { tabId: currentTab?.id }, 'background')
    }
  } catch (e) {
    console.error('Failed to open side panel:', e)
  }
}
</script>

<template>
  <main class="w-[300px] px-[16px] py-5 text-gray-800 dark:text-gray-200">
    <div class="flex items-center justify-center gap-[12px] mb-[24px]">
      <h1 class="text-xl font-bold">Highlight Mark Flow</h1>
    </div>

    <p class="mb-[24px] text-center text-[14px]">
      你已经创建了
      <strong class="text-blue-600 text-base">{{ totalMarks }}</strong>
      条标记。
    </p>

    <div class="flex flex-col gap-[12px]">
      <button class="btn-secondary" @click="openSidePanel">打开侧边栏</button>
      <button class="btn-secondary" @click="openOptionsPage">设置</button>
    </div>
  </main>
</template>
