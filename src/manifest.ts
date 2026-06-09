import fs from 'fs-extra'
import type { Manifest } from 'webextension-polyfill'
import type PkgType from '../package.json'
import { isDev, isFirefox, port, r } from '../scripts/utils'

export async function getManifest() {
  const pkg = (await fs.readJSON(r('package.json'))) as typeof PkgType

  // update this file to update this manifest.json
  // can also be conditional based on your need
  const manifest: Manifest.WebExtensionManifest = {
    manifest_version: 3,
    name: pkg.displayName || pkg.name,
    version: pkg.version,
    description: pkg.description,
    action: {
      default_icon: 'assets/icon-512.png',
      default_popup: 'dist/popup/index.html',
    },
    options_ui: {
      page: 'dist/options/index.html',
      open_in_tab: true,
    },
    background: isFirefox
      ? {
          scripts: ['dist/background/index.mjs'],
          type: 'module',
        }
      : {
          service_worker: 'dist/background/index.mjs',
        },
    icons: {
      16: 'assets/icon-16.png',
      48: 'assets/icon-48.png',
      128: 'assets/icon-128.png',
    },
    permissions: ['tabs', 'storage', 'activeTab', 'sidePanel', 'unlimitedStorage'],
    host_permissions: ['*://*/*'],
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['dist/contentScripts/index.global.js'],
      },
    ],
    web_accessible_resources: [
      {
        resources: ['dist/contentScripts/style.css'],
        matches: ['<all_urls>'],
      },
    ],
    content_security_policy: {
      extension_pages: isDev
        ? `script-src \'self\' http://localhost:${port}; object-src \'self\'` // this is required on dev for Vite script to load
        : 'script-src \'self\'; object-src \'self\'',
    },
  }

  if (isFirefox) {
    ;(manifest as any).browser_specific_settings = {
      gecko: {
        // 请保留您的唯一 ID
        id: 'new-highlight-mark-flow@flow.soulboy.site',
        strict_min_version: '109.0',
        // 关键修正：数据收集权限声明
        data_collection_permissions: {
          // 必须是对象，包含 required 属性

          // 关键修正：使用 AMO 允许的抽象数据类型关键词，满足内容校验和计数要求
          required: ['websiteContent'],

          // 保持 "denied" 结构不变，用于向用户解释您的真实隐私实践（本地存储）
          denied: [
            {
              api: 'host_permissions',
              text: '此扩展程序仅使用 Storage API 在本地存储用户的高亮内容和设置数据。不收集、不存储、也不向任何外部服务器传输任何个人身份信息。',
            },
            {
              api: 'storage',
              text: '本地存储仅用于在本地缓存用户设置和高亮数据。',
            },
          ],
        },
      },
    }
  }

  manifest.homepage_url = 'https://flow.soulboy.site/'

  // add sidepanel
  if (isFirefox) {
    manifest.sidebar_action = {
      default_panel: 'dist/sidepanel/index.html',
      default_icon: 'assets/icon-16.png',
      default_title: manifest.name,
    }
  }
  else {
    // the sidebar_action does not work for chromium based
    ;(manifest as any).side_panel = {
      default_path: 'dist/sidepanel/index.html',
    }
  }

  return manifest
}
