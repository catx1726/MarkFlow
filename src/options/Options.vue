<script setup lang="ts">
import { computed, reactive, ref, watch, watchEffect } from 'vue'
import { usePreferredDark } from '@vueuse/core'
import { settings } from '~/logic/settings'
import { cloneDeep } from 'lodash-es'
import { sendMessage } from 'webext-bridge/options'

const isDark = usePreferredDark()
watchEffect(() => {
  if (isDark.value) document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
})
// Local state for editing to enable explicit saving
const localSettings = reactive(cloneDeep(settings.value))
const saveStatus = ref('')
let saveTimeout: number | undefined

// Watch for external changes to settings (e.g., sync) and update local state
watch(
  settings,
  (newSettings) => {
    Object.assign(localSettings, cloneDeep(newSettings))
  },
  { deep: true }
)

const blacklistText = computed({
  get: () => localSettings.blacklist.join('\n'),
  set: (value) => {
    localSettings.blacklist = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
})

const alertInfo = reactive({
  visible: false,
  message: ''
})

function showAlert(message: string) {
  alertInfo.message = message
  alertInfo.visible = true
}

function hideAlert() {
  alertInfo.visible = false
}

function addColor() {
  localSettings.highlightColors.push('#000000')
}

function removeColor(index: number) {
  if (localSettings.highlightColors.length <= 1) {
    showAlert('至少需要保留一种高亮颜色。')
    return
  }
  // If removing the default color, set a new default
  if (localSettings.highlightColors[index] === localSettings.defaultHighlightColor)
    localSettings.defaultHighlightColor = localSettings.highlightColors[index === 0 ? 1 : 0]

  localSettings.highlightColors.splice(index, 1)
}

function saveSettings() {
  settings.value = cloneDeep(localSettings)
  saveStatus.value = '设置已保存！'
  clearTimeout(saveTimeout)
  saveTimeout = window.setTimeout(() => {
    saveStatus.value = ''
  }, 2000)
  // 通知 background 脚本设置已更新，以便它可以广播刷新指令
  sendMessage('refresh-sidepanel-data', {}, 'background').catch(() => {
    // 忽略错误
  })
}
</script>

<template>
  <main class="w-full max-w-[768px] mx-auto px-[16px] py-[40px] text-gray-700 dark:text-gray-200 min-h-screen">
    <h1 class="text-[24px] font-bold mb-[32px]">设置</h1>

    <div class="space-y-8">
      <!-- Welcome Guide -->
      <div class="setting-card border-l-4 border-blue-500">
        <h2 class="text-[18px] font-semibold mb-[16px] flex items-center gap-2">👋 欢迎使用 MarkFlow</h2>
        <div class="space-y-4 text-[14px]">
          <!-- Quick Start -->
          <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
            <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">🚀 快速开始</h3>
            <p class="text-gray-600 dark:text-gray-300">
              在任意网页，按住
              <kbd class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 font-mono text-xs border border-gray-300 dark:border-gray-500">Alt</kbd>
              键并拖动鼠标选中文字，即可唤起高亮工具栏。
            </p>
          </div>

          <!-- Core Features -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">✨ 核心功能</h3>
              <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                <li>
                  <strong>标记 (Mark)</strong>
                  ：多彩高亮，捕捉灵感
                </li>
                <li>
                  <strong>回顾 (Review)</strong>
                  ：一览所有标记片段
                </li>
              </ul>
            </div>
            <div>
              <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">&nbsp;</h3>
              <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                <li>
                  <strong>跳转 (Jump)</strong>
                  ：点击快速定位上下文
                </li>
                <li>
                  <strong>整理 (Organize)</strong>
                  ：高效管理知识碎片
                </li>
              </ul>
            </div>
          </div>

          <!-- Acknowledgments -->
          <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
            <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">❤️ 致谢与支持</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-2">
              感谢您的使用！如果您觉得这个工具对您有帮助，欢迎在商店评分或分享给朋友。
            </p>
            <div class="flex gap-4">
              <a
                href="https://github.com/catx1726/MarkFlow"
                target="_blank"
                class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                GitHub
              </a>
              <a
                href="https://addons.mozilla.org/zh-CN/firefox/addon/markflow/"
                target="_blank"
                class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                Firefox Add-ons
              </a>
            </div>
          </div>
        </div>
      </div>
      <!-- Default Highlight Color -->
      <div class="setting-card">
        <h2 class="text-[18px] font-semibold mb-[12px]">默认高亮颜色</h2>
        <p class="text-[14px] text-gray-500 mb-[16px]">选择在创建新高亮时默认使用的颜色。</p>
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
            />
            <span class="h-[24px] w-[24px] rounded-full border border-gray-300" :style="{ backgroundColor: color }" />
          </label>
        </div>
      </div>

      <!-- Highlight Color Palette -->
      <div class="setting-card">
        <h2 class="text-[18px] font-semibold mb-[12px]">高亮颜色配置</h2>
        <p class="text-[14px] text-gray-500 mb-[16px]">自定义在工具提示中可用的颜色选项。</p>
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
            />
            <input
              v-model="localSettings.highlightColors[index]"
              type="text"
              class="flex-1 px-[8px] py-[4px] border rounded-md bg-gray-50 dark:bg-gray-800"
            />
            <button class="p-[8px] text-gray-500 hover:text-red-500" title="移除颜色" @click="removeColor(index)">
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
          class="mt-[16px] px-[16px] py-2 text-[14px] font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          @click="addColor"
        >
          添加颜色
        </button>
      </div>

      <!-- Shortcut Settings -->
      <div class="setting-card">
        <h2 class="text-[18px] font-semibold mb-[12px]">快捷键设置</h2>
        <p class="text-[14px] text-gray-500 mb-[16px]">自定义保存和删除操作的快捷键 (例如: Alt+S, Ctrl+Shift+D)。</p>
        <div class="space-y-4">
          <div class="flex items-center gap-[16px]">
            <label for="shortcut-save" class="w-[96px] shrink-0">保存标记:</label>
            <input
              id="shortcut-save"
              v-model="localSettings.shortcutSave"
              type="text"
              class="flex-1 px-[8px] py-[4px] border rounded-md bg-gray-50 dark:bg-gray-800"
            />
          </div>
          <div class="flex items-center gap-[16px]">
            <label for="shortcut-delete" class="w-[96px] shrink-0">删除标记:</label>
            <input
              id="shortcut-delete"
              v-model="localSettings.shortcutDelete"
              type="text"
              class="flex-1 px-[8px] py-[4px] border rounded-md bg-gray-50 dark:bg-gray-800"
            />
          </div>
        </div>
      </div>

      <!-- Blacklist -->
      <div class="setting-card">
        <h2 class="text-[18px] font-semibold mb-[12px]">网站黑名单</h2>
        <p class="text-[14px] text-gray-500 mb-[16px]">在以下网站禁用此插件，每行输入一个域名（例如 example.com）。</p>
        <textarea
          v-model="blacklistText"
          rows="5"
          class="w-full p-[8px] border rounded-md bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
          placeholder="google.com&#10;github.com"
        />
      </div>

      <!-- Error Logs -->
      <div class="setting-card">
        <h2 class="text-[18px] font-semibold mb-[12px]">错误日志</h2>
        <p class="text-[14px] text-gray-500 mb-[16px]">如果扩展运行异常，请导出错误日志发送给我们。</p>
        <button
          class="px-[16px] py-2 text-[14px] font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700"
          @click="exportLogs"
        >
          导出错误日志
        </button>
      </div>
    </div>

    <!-- Save Button and Status -->
    <div
      class="mt-[32px] pt-[24px] border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-[16px]"
    >
      <span v-if="saveStatus" class="text-green-600 text-[14px] transition-opacity duration-300">{{ saveStatus }}</span>
      <button
        class="px-[16px] py-[8px] text-[14px] font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        @click="saveSettings"
      >
        保存设置
      </button>
    </div>

    <script setup lang="ts">
import { computed, reactive, ref, watch, watchEffect } from 'vue'
import { usePreferredDark } from '@vueuse/core'
import { settings } from '~/logic/settings'
import { cloneDeep } from 'lodash-es'
import { sendMessage } from 'webext-bridge/options'
import { getLogs } from '../logic/errorCollector'

async function exportLogs() {
  const logs = await getLogs()
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `error-logs-${Date.now()}.json`
  a.click()
}
...

    <!-- 弹窗提示 -->
    <div
      v-if="alertInfo.visible"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="hideAlert"
    >
      <div
        class="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-[24px] w-full max-w-sm text-gray-800 dark:text-gray-200"
      >
        <h3 class="text-[18px] font-semibold mb-[16px]">提示</h3>
        <p class="text-[14px] mb-[24px]">
          {{ alertInfo.message }}
        </p>
        <div class="flex justify-end">
          <button
            class="px-[16px] py-2 text-[14px] font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            @click="hideAlert"
          >
            确认
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
</style>
