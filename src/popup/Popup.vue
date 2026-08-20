<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { sendMessage } from 'webext-bridge/popup'
import { usePreferredDark } from '@vueuse/core'
import { marksByUrl } from '~/logic/storage'

import { isPageBlacklisted, settings } from '~/logic/settings'

const currentTab = ref<any>(null)

onMounted(async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  currentTab.value = tabs[0]
})

const isBlocked = computed(() => {
  if (!currentTab.value?.url)
    return false
  return isPageBlacklisted(currentTab.value.url, settings.value.blacklist)
})

const reloadRequired = ref(false)

function toggleBlacklist() {
  if (!currentTab.value?.url)
    return
  const url = new URL(currentTab.value.url)
  const hostname = url.hostname

  if (isBlocked.value) {
    settings.value.blacklist = settings.value.blacklist.filter(pattern => !hostname.endsWith(pattern))
  }
  else {
    settings.value.blacklist.push(hostname)
  }
  reloadRequired.value = true
}

function reloadPage() {
  if (currentTab.value?.id) {
    // 通知 background 广播刷新消息给侧边栏
    // 我们不直接发给 sidepanel，因为在某些情况下 popup 无法直接定位到 sidepanel 上下文
    sendMessage('refresh-sidepanel-data', {}, 'background').catch(() => {
      // 忽略发送失败（例如 background 暂时不可达，虽然很少见）
    })
    browser.tabs.reload(currentTab.value.id)
    window.close()
  }
}

// Automatically apply dark mode class to the root element
const isDark = usePreferredDark()
watchEffect(() => {
  if (isDark.value)
    document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
})
const totalMarks = computed(() => {
  return Object.values(marksByUrl.value).flat().length
})

function openOptionsPage() {
  browser.runtime.openOptionsPage()
  window.close()
}

async function openSidePanel() {
  try {
    // Firefox: sidebarAction.open() 必须在用户输入处理程序中调用
    if (browser.sidebarAction && typeof browser.sidebarAction.open === 'function') {
      await browser.sidebarAction.open()
      return
    }

    // Chrome: sidePanel.open() 必须在用户手势上下文中直接调用，
    // 通过 background 中转会失去手势上下文导致调用失败
    const sidePanel = (browser as any).sidePanel
    if (sidePanel && typeof sidePanel.open === 'function') {
      const currentWindow = await browser.windows.getCurrent()
      if (currentWindow.id != null) {
        await sidePanel.open({ windowId: currentWindow.id })
      }
      return
    }

    console.error('Side panel/Sidebar API not found.')
  }
  catch (e) {
    console.error('Failed to open side panel:', e)
  }
}
</script>

<template>
  <main class="w-[300px] px-4 py-5 text-center text-gray-700 dark:text-gray-200">
    <div class="flex items-center justify-center gap-[12px] mb-[24px]">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-amber-600" width="24" height="24" viewBox="0 0 24 24">
        <path fill="currentColor" d="M18 2h-2v2h-2v2h-2v2h-2v2H8v2H6v2H4v2H2v6h6v-2h2v-2h2v-2h2v-2h2v-2h2v-2h2V8h2V6h-2V4h-2zm0 8h-2v2h-2v2h-2v2h-2v2H8v-2H6v-2h2v-2h2v-2h2V8h2V6h2v2h2zM6 16H4v4h4v-2H6z" />
      </svg>
      <h1 class="text-xl font-bold">
        MarkFlow
      </h1>
    </div>

    <p class="mb-[24px] text-center text-[14px]">
      你已经创建了
      <strong class="text-amber-600 text-base">{{ totalMarks }}</strong>
      条标记。
    </p>

    <div class="flex flex-col gap-[12px]">
      <button class="btn-secondary" @click="openOptionsPage">
        设置
      </button>
      <button
        class="px-4 py-2 rounded-md bg-amber-500 text-gray-900 font-medium shadow-sm transition-colors hover:bg-amber-600"
        @click="openSidePanel"
      >
        打开侧边栏
      </button>
      <button class="btn-secondary" @click="toggleBlacklist">
        {{ isBlocked ? '在此网站启用' : '在此网站禁用' }}
      </button>

      <div
        v-if="reloadRequired"
        class="text-xs text-orange-600 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 p-2 rounded border border-orange-200 dark:border-orange-800 animate-fade-in"
      >
        <p class="mb-1 font-medium">
          状态已更新，需刷新页面生效。
        </p>
        <button
          class="underline hover:text-orange-800 dark:hover:text-orange-100 transition-colors"
          @click="reloadPage"
        >
          立即刷新
        </button>
      </div>
    </div>
  </main>
</template>
