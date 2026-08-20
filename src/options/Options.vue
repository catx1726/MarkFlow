<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch, watchEffect } from 'vue'
import { usePreferredDark } from '@vueuse/core'
import { cloneDeep } from 'lodash-es'
import browser from 'webextension-polyfill'
import { sendMessage } from 'webext-bridge/options'
import { getLogs } from '../logic/errorCollector'
import { getActiveSectionId } from './scrollSpy'
import { settings } from '~/logic/settings'
import { dataReady, marksByUrl, syncConfig, syncReady, syncStatus, tagsMetadata, tagsReady } from '~/logic/storage'
import { createGist, getGists } from '~/logic/sync'
import { t } from '~/logic/i18n'

const isDark = usePreferredDark()
watchEffect(() => {
  if (isDark.value)
    document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
})
// Local state for editing to enable explicit saving
const localSettings = reactive(cloneDeep(settings.value))
const saveStatus = ref('')
const syncConnectStatus = ref('')
const isJustSaved = ref(false)
let saveTimeout: number | undefined
let saveResetTimeout: number | undefined

// Watch for external changes to settings (e.g., sync) and update local state
watch(
  settings,
  (newSettings) => {
    Object.assign(localSettings, cloneDeep(newSettings))
  },
  { deep: true },
)

const blacklistText = computed({
  get: () => localSettings.blacklist.join('\n'),
  set: (value) => {
    localSettings.blacklist = value
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
  },
})

const alertInfo = reactive({
  visible: false,
  title: t('options.alertTitle'),
  message: '',
  isHtml: false,
})

function showAlert(message: string, title = t('options.alertTitle'), isHtml = false) {
  alertInfo.title = title
  alertInfo.message = message
  alertInfo.isHtml = isHtml
  alertInfo.visible = true
}

function hideAlert() {
  alertInfo.visible = false
}

function showSyncHelp() {
  showAlert(t('sync.helpContent'), t('sync.helpTitle'), true)
}

function addColor() {
  localSettings.highlightColors.push('#000000')
}

function removeColor(index: number) {
  if (localSettings.highlightColors.length <= 1) {
    showAlert(t('options.minOneColor'))
    return
  }
  // If removing the default color, set a new default
  if (localSettings.highlightColors[index] === localSettings.defaultHighlightColor)
    localSettings.defaultHighlightColor = localSettings.highlightColors[index === 0 ? 1 : 0]

  localSettings.highlightColors.splice(index, 1)
}

async function saveSettings() {
  settings.value = cloneDeep(localSettings)
  saveStatus.value = t('options.settingsSaved')
  isJustSaved.value = true
  clearTimeout(saveTimeout)
  clearTimeout(saveResetTimeout)
  saveTimeout = window.setTimeout(() => {
    saveStatus.value = ''
  }, 2000)
  saveResetTimeout = window.setTimeout(() => {
    isJustSaved.value = false
  }, 2000)
  // 通知 background 脚本设置已更新，以便它可以广播刷新指令
  sendMessage('refresh-sidepanel-data', {}, 'background').catch(() => {
    // 忽略错误
  })
  // 通知所有 content script 刷新高亮样式
  const tabs = await browser.tabs.query({ status: 'complete' })
  for (const tab of tabs) {
    if (tab.id && tab.url && tab.url.startsWith('http')) {
      sendMessage('refresh-highlights', {}, { context: 'content-script', tabId: tab.id }).catch(() => {})
    }
  }
}

async function exportLogs() {
  const logs = await getLogs()
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `error-logs-${Date.now()}.json`
  a.click()
}

function withTimeout<T>(promise: Promise<T>, ms: number, reason: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(reason)), ms)
  })
  return Promise.race([promise, timeout])
}

async function connectSync() {
  if (!syncConfig.value.token) {
    showAlert(t('options.enterToken'))
    return
  }

  syncConnectStatus.value = t('options.connecting')

  try {
    await Promise.all([dataReady, tagsReady, syncReady])

    // Wake up service worker before sending sync message (MV3 reliability)
    try {
      await browser.runtime.getPlatformInfo()
    }
    catch {
      // ignore
    }

    const gists = await getGists(syncConfig.value.token)
    // 查找包含 markflow_sync.json 的 Gist
    const existingGist = gists.find(g => g.files && g.files['markflow_sync.json'])

    if (existingGist) {
      syncConfig.value.gistId = existingGist.id
      // 先强制拉取并合并远程数据，成功后再启用自动同步，防止本地空数据覆盖远程
      // webext-bridge 在 MV3 下有时不返回响应，加超时避免 UI 卡住
      try {
        await triggerPull({ force: true, token: syncConfig.value.token, gistId: existingGist.id })
        syncConfig.value.enabled = true
        showAlert(t('options.connectedExisting'))
      }
      catch (err: any) {
        // 拉取失败时重置 gistId，避免用户下次手动启用同步时使用了错误/未验证的 Gist ID
        syncConfig.value.gistId = ''
        throw err
      }
    }
    else {
      // 创建新的
      const newGist = await createGist(syncConfig.value.token, {
        marks: marksByUrl.value,
        tags: tagsMetadata.value,
        lastSync: Date.now(),
      })
      syncConfig.value.gistId = newGist.id
      syncConfig.value.enabled = true
      showAlert(t('options.createdNewGist'))
      // 新 Gist 创建后拉取一次，以将 lastSyncStatus 置为 success，后续推送才能正常进行
      triggerPull({ force: true, token: syncConfig.value.token, gistId: newGist.id }).catch((err: any) => {
        console.error('[Options] trigger-sync failed:', err)
      })
    }
  }
  catch (err: any) {
    showAlert(t('options.connectFailed', { message: err.message }))
  }
  finally {
    syncConnectStatus.value = ''
  }
}

async function triggerPull({ force = false, timeoutMs = 8000, token = '', gistId = '' } = {}) {
  const payload = { force, token, gistId }
  // eslint-disable-next-line no-console -- 同步诊断日志，待 Logger 封装（见 NIT_ROADMAP §3）统一处理
  console.log('[Options] triggerPull started', { force, hasToken: !!token, hasGistId: !!gistId })
  try {
    const result = await withTimeout(
      sendMessage('trigger-sync', payload, 'background'),
      timeoutMs,
      'trigger-sync timeout',
    )
    // eslint-disable-next-line no-console -- 同步诊断日志，待 Logger 封装统一处理
    console.log('[Options] webext-bridge trigger-sync succeeded:', result)
    return result
  }
  catch (bridgeError: any) {
    console.warn('[Options] webext-bridge trigger-sync failed, falling back to runtime message:', bridgeError)
    const fallbackResult = await withTimeout(
      browser.runtime.sendMessage({ type: 'trigger-sync-pull', ...payload }),
      timeoutMs,
      'trigger-sync-pull timeout',
    )
    // eslint-disable-next-line no-console -- 同步诊断日志，待 Logger 封装统一处理
    console.log('[Options] runtime fallback trigger-sync-pull result:', fallbackResult)
    return fallbackResult
  }
}

// ========== 左侧导航与 Scroll Spy ==========
const navItems = [
  { id: 'welcome', label: 'options.navWelcome' },
  { id: 'general', label: 'options.navGeneral' },
  { id: 'default-color', label: 'options.defaultColor' },
  { id: 'highlight-height', label: 'options.highlightHeight' },
  { id: 'color-palette', label: 'options.colorPalette' },
  { id: 'shortcuts', label: 'options.shortcuts' },
  { id: 'blacklist', label: 'options.blacklist' },
  { id: 'github-sync', label: 'options.githubSync' },
  { id: 'error-logs', label: 'options.errorLogs' },
]

const activeSection = ref('welcome')

let isClickScrolling = false
let clickScrollTimeout: number | undefined
let clickTargetId: string | null = null
let rafId: number | null = null

function isElementInViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  return rect.top < window.innerHeight && rect.bottom > 0
}

function scrollToSection(id: string) {
  activeSection.value = id
  clickTargetId = id
  isClickScrolling = true
  clearTimeout(clickScrollTimeout)
  clickScrollTimeout = window.setTimeout(() => {
    isClickScrolling = false
    const target = clickTargetId ? document.getElementById(clickTargetId) : null
    // 如果目标元素仍在视口中，保持高亮目标；否则按滚动位置校正
    if (target && isElementInViewport(target)) {
      activeSection.value = clickTargetId!
    }
    else {
      updateActiveSection()
    }
    clickTargetId = null
  }, 1000)
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function updateActiveSection() {
  const sections = navItems.map(item => ({
    id: item.id,
    offsetTop: document.getElementById(item.id)?.offsetTop ?? 0,
  }))
  activeSection.value = getActiveSectionId(
    window.scrollY,
    window.innerHeight,
    document.documentElement.scrollHeight,
    sections,
  )
}

function onScroll() {
  if (isClickScrolling)
    return
  if (rafId)
    return
  rafId = requestAnimationFrame(() => {
    updateActiveSection()
    rafId = null
  })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  updateActiveSection()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  clearTimeout(clickScrollTimeout)
  if (rafId)
    cancelAnimationFrame(rafId)
})
</script>

<template>
  <main class="w-full max-w-[1100px] mx-auto px-[16px] py-[40px] text-gray-700 dark:text-gray-200 min-h-screen">
    <div class="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-[32px]">
      <!-- 左侧导航 -->
      <aside class="hidden md:block">
        <div class="sticky top-[40px] self-start">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-[16px]">
            <h1 class="text-[20px] font-bold mb-[16px] text-gray-900 dark:text-gray-100">
              {{ t('options.settingsTitle') }}
            </h1>
            <nav class="space-y-1">
              <button
                v-for="item in navItems"
                :key="item.id"
                class="w-full text-left px-[12px] py-[8px] rounded-md text-[14px] transition-colors relative"
                :class="activeSection === item.id
                  ? 'text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
                @click="scrollToSection(item.id)"
              >
                <span
                  v-if="activeSection === item.id"
                  class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-amber-500 rounded-r-full"
                />
                {{ t(item.label) }}
              </button>
            </nav>
            <div class="mt-[16px] pt-[16px] border-t border-gray-100 dark:border-gray-700">
              <button
                class="w-full px-[16px] py-[8px] text-[14px] font-medium rounded-md transition-colors"
                :class="isJustSaved
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-amber-500 text-gray-900 hover:bg-amber-600'"
                :disabled="isJustSaved"
                @click="saveSettings"
              >
                {{ isJustSaved ? t('options.savedShort') : t('options.saveSettings') }}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧内容 -->
      <div class="space-y-8">
        <!-- Welcome Guide -->
        <div id="welcome" class="setting-card border-l-4 border-amber-500 scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[16px] flex items-center gap-2">
            {{ t('options.welcomeTitle') }}
          </h2>
          <div class="space-y-4 text-[14px]">
            <!-- Quick Start -->
            <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
              <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">
                {{ t('options.quickStartTitle') }}
              </h3>
              <p class="text-gray-600 dark:text-gray-300">
                {{ t('options.quickStartPrefix') }}
                <kbd class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 font-mono text-xs border border-gray-300 dark:border-gray-500">Alt</kbd>
                {{ t('options.quickStartSuffix') }}
              </p>
            </div>

            <!-- Core Features -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {{ t('options.coreFeaturesTitle') }}
                </h3>
                <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                  <li>
                    <strong>{{ t('options.featureMarkName') }}</strong>
                    {{ t('options.featureMarkDesc') }}
                  </li>
                  <li>
                    <strong>{{ t('options.featureReviewName') }}</strong>
                    {{ t('options.featureReviewDesc') }}
                  </li>
                </ul>
              </div>
              <div>
                <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">
&nbsp;
                </h3>
                <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                  <li>
                    <strong>{{ t('options.featureJumpName') }}</strong>
                    {{ t('options.featureJumpDesc') }}
                  </li>
                  <li>
                    <strong>{{ t('options.featureOrganizeName') }}</strong>
                    {{ t('options.featureOrganizeDesc') }}
                  </li>
                </ul>
              </div>
            </div>

            <!-- Acknowledgments -->
            <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
              <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">
                {{ t('options.thanksTitle') }}
              </h3>
              <p class="text-gray-600 dark:text-gray-400 mb-2">
                {{ t('options.thanksDesc') }}
              </p>
              <div class="flex gap-4">
                <a
                  href="https://github.com/catx1726/MarkFlow"
                  target="_blank"
                  class="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline"
                >
                  GitHub
                </a>
                <a
                  href="https://addons.mozilla.org/zh-CN/firefox/addon/markflow/"
                  target="_blank"
                  class="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline"
                >
                  Firefox Add-ons
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Default Highlight Color -->
        <!-- General -->
        <div id="general" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            {{ t('options.navGeneral') }}
          </h2>
          <p class="text-[14px] text-gray-500 mb-[4px]">
            {{ t('options.languageLabel') }}
          </p>
          <p class="text-[13px] text-gray-400 mb-[12px]">
            {{ t('options.languageDesc') }}
          </p>
          <select
            v-model="localSettings.language"
            class="px-[12px] py-[8px] text-[14px] rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="auto">
              {{ t('options.languageAuto') }}
            </option>
            <option value="zh-CN">
              {{ t('options.languageZh') }}
            </option>
            <option value="en">
              {{ t('options.languageEn') }}
            </option>
          </select>
        </div>

        <!-- Default Color -->
        <div id="default-color" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            {{ t('options.defaultColor') }}
          </h2>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            {{ t('options.defaultColorDesc') }}
          </p>
          <div class="flex flex-wrap gap-[12px]">
            <label
              v-for="color in localSettings.highlightColors"
              :key="color"
              class="flex items-center gap-[8px] cursor-pointer"
            >
              <input
                v-model="localSettings.defaultHighlightColor"
                type="radio"
                :value="color"
                name="default-color"
                class="h-[20px] w-[20px]"
              >
              <span class="h-[24px] w-[24px] rounded-full border border-gray-300" :style="{ backgroundColor: color }" />
            </label>
          </div>
        </div>

        <!-- Highlight Height -->
        <div id="highlight-height" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            {{ t('options.highlightHeight') }}
          </h2>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            {{ t('options.highlightHeightDesc') }}
          </p>
          <div class="flex items-center gap-[16px]">
            <input
              v-model.number="localSettings.highlightHeight"
              type="range"
              min="1"
              max="20"
              class="flex-1"
            >
            <span class="w-[48px] text-center font-mono text-[14px]">{{ localSettings.highlightHeight }}px</span>
          </div>
          <div class="mt-[16px]">
            <span class="text-[14px] text-gray-500">{{ t('options.previewLabel') }}</span>
            <span
              class="text-[14px]"
              :style="{ boxShadow: `inset 0 -${localSettings.highlightHeight}px 0 0 ${localSettings.defaultHighlightColor}`, paddingBottom: `${localSettings.highlightHeight}px` }"
            >
              {{ t('options.previewText') }}
            </span>
          </div>
        </div>

        <!-- Highlight Color Palette -->
        <div id="color-palette" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            {{ t('options.colorPalette') }}
          </h2>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            {{ t('options.colorPaletteDesc') }}
          </p>
          <div class="space-y-3">
            <div
              v-for="(color, index) in localSettings.highlightColors"
              :key="index"
              class="flex items-center gap-[12px]"
            >
              <input
                v-model="localSettings.highlightColors[index]"
                type="color"
                class="h-8 w-12 p-[4px] border rounded"
              >
              <input
                v-model="localSettings.highlightColors[index]"
                type="text"
                class="flex-1 px-[8px] py-[4px] border rounded-md bg-gray-50 dark:bg-gray-800"
              >
              <button class="p-[8px] text-gray-500 hover:text-red-500" :title="t('options.removeColor')" @click="removeColor(index)">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-[20px] w-[20px]" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
          <button
            class="mt-[16px] px-[16px] py-2 text-[14px] font-medium text-gray-900 bg-amber-500 rounded-md hover:bg-amber-600"
            @click="addColor"
          >
            {{ t('options.addColor') }}
          </button>
        </div>

        <!-- Shortcut Settings -->
        <div id="shortcuts" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            {{ t('options.shortcuts') }}
          </h2>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            {{ t('options.shortcutsDesc') }}
          </p>
          <div class="space-y-4">
            <div class="flex items-center gap-[16px]">
              <label for="shortcut-save" class="w-[96px] shrink-0">{{ t('options.shortcutSaveLabel') }}</label>
              <input
                id="shortcut-save"
                v-model="localSettings.shortcutSave"
                type="text"
                class="flex-1 px-[8px] py-[4px] border rounded-md bg-gray-50 dark:bg-gray-800"
              >
            </div>
            <div class="flex items-center gap-[16px]">
              <label for="shortcut-delete" class="w-[96px] shrink-0">{{ t('options.shortcutDeleteLabel') }}</label>
              <input
                id="shortcut-delete"
                v-model="localSettings.shortcutDelete"
                type="text"
                class="flex-1 px-[8px] py-[4px] border rounded-md bg-gray-50 dark:bg-gray-800"
              >
            </div>
          </div>
        </div>

        <!-- Blacklist -->
        <div id="blacklist" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            {{ t('options.blacklist') }}
          </h2>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            {{ t('options.blacklistDesc') }}
          </p>
          <textarea
            v-model="blacklistText"
            rows="5"
            class="w-full p-[8px] border rounded-md bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-amber-500"
            placeholder="google.com&#10;github.com"
          />
        </div>

        <!-- GitHub Sync -->
        <div id="github-sync" class="setting-card scroll-mt-8">
          <div class="flex justify-between items-center mb-[12px]">
            <h2 class="text-[18px] font-semibold">
              {{ t('options.githubSync') }}
            </h2>
            <button
              class="text-amber-500 hover:text-amber-700 flex items-center gap-1 text-[13px]"
              @click="showSyncHelp"
            >
              <div class="i-carbon-help text-[16px]" />
              {{ t('options.syncGuide') }}
            </button>
          </div>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            {{ t('options.syncDesc') }}
          </p>
          <div class="space-y-4">
            <div class="flex flex-col gap-2">
              <label class="text-[14px] font-medium">GitHub Personal Access Token (classic)</label>
              <input
                v-model="syncConfig.token"
                type="password"
                class="w-full px-[8px] py-[4px] border rounded-md bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-amber-500"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxx"
              >
              <p class="text-[12px] text-gray-400">
                {{ t('options.tokenScopePrefix') }}<strong>'gist'</strong>{{ t('options.tokenScopeSuffix') }}
                <a
                  href="https://github.com/settings/tokens/new?scopes=gist&description=MarkFlow-Sync"
                  target="_blank"
                  class="text-amber-500 hover:underline"
                >
                  {{ t('options.generateToken') }}
                </a>
              </p>
              <p class="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                {{ t('options.tokenWarning') }}
              </p>
            </div>

            <div class="flex items-center gap-4">
              <button
                class="px-[16px] py-2 text-[14px] font-medium text-gray-900 bg-amber-500 rounded-md hover:bg-amber-600 disabled:opacity-50"
                :disabled="!syncConfig.token || syncConnectStatus !== ''"
                @click="connectSync"
              >
                {{ syncConfig.enabled ? t('options.reconnect') : t('options.connectAndSync') }}
              </button>
              <div v-if="syncConfig.gistId" class="flex flex-col">
                <span class="text-[12px] font-medium" :class="syncStatus.lastSyncStatus === 'error' ? 'text-red-500' : 'text-green-600'">
                  ● {{ syncStatus.lastSyncStatus === 'error' ? t('options.syncFailed') : t('options.syncConnected') }}
                </span>
                <span class="text-[11px] text-gray-400">{{ t('options.lastSync') }}{{ syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleString() : 'never' }}</span>
                <p v-if="syncStatus.errorMessage" class="text-[11px] text-red-400 mt-1">
                  {{ syncStatus.errorMessage }}
                </p>
              </div>
            </div>
            <p v-if="syncConnectStatus !== ''" class="text-[13px] text-amber-700 dark:text-amber-400">
              {{ syncConnectStatus }}
            </p>

            <div v-if="syncConfig.gistId" class="pt-2 border-t border-gray-100 dark:border-gray-700">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="syncConfig.enabled" type="checkbox" class="h-4 w-4">
                <span class="text-[14px]">{{ t('options.enableAutoSync') }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Error Logs -->
        <div id="error-logs" class="setting-card scroll-mt-8">
          <h2 class="text-[18px] font-semibold mb-[12px]">
            {{ t('options.errorLogs') }}
          </h2>
          <p class="text-[14px] text-gray-500 mb-[16px]">
            {{ t('options.errorLogsDesc') }}
          </p>
          <button
            class="px-[16px] py-2 text-[14px] font-medium text-gray-900 bg-amber-500 rounded-md hover:bg-amber-600"
            @click="exportLogs"
          >
            {{ t('options.exportLogs') }}
          </button>
        </div>

        <!-- Save Button and Status -->
        <div
          class="pt-[24px] border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-[16px]"
        >
          <span v-if="saveStatus" class="text-green-600 text-[14px] transition-opacity duration-300">{{ saveStatus }}</span>
          <button
            class="px-[16px] py-[8px] text-[14px] font-medium text-gray-900 bg-amber-500 rounded-md hover:bg-amber-600"
            @click="saveSettings"
          >
            {{ t('options.saveSettings') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 弹窗提示 -->
    <div
      v-if="alertInfo.visible"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      @click.self="hideAlert"
    >
      <div
        class="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-[24px] w-full max-w-md text-gray-800 dark:text-gray-200"
      >
        <h3 class="text-[18px] font-semibold mb-[16px]">
          {{ alertInfo.title }}
        </h3>
        <div v-if="alertInfo.isHtml" class="text-[14px] mb-[24px]" v-html="alertInfo.message" />
        <p v-else class="text-[14px] mb-[24px]">
          {{ alertInfo.message }}
        </p>
        <div class="flex justify-end">
          <button
            class="px-[16px] py-2 text-[14px] font-medium text-gray-900 bg-amber-500 rounded-md hover:bg-amber-600"
            @click="hideAlert"
          >
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.setting-card {
  @apply bg-white dark:bg-gray-800 p-[24px] rounded-lg shadow-md;
}

/* 确保平滑滚动生效 */
html {
  scroll-behavior: smooth;
}
</style>
