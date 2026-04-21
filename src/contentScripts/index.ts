import { reactive } from 'vue'
import { MarkerApp } from './MarkerApp'
import type { AppState } from './types'
import { collectError } from '../logic/errorCollector'
import '../styles'

window.addEventListener('error', (event) => collectError(event.error, 'content'))
window.addEventListener('unhandledrejection', (event) => collectError(event.reason, 'content'))

/* eslint-disable no-console */
console.log('[WebMarker] CONTENT SCRIPT LOADED AT TOP LEVEL')

const state = reactive<AppState>({
  isRestoring: false,
  ambiguousMarks: [],
  currentSelection: null,
  serializedSelection: null,
  currentSerializationRoot: undefined,
  currentMarkIdForColorChange: null,
  settings: {} // Initialized in MarkerApp via settingsReady
})

const app = new MarkerApp(state)
app.init().catch(err => {
  console.error('[WebMarker] Failed to initialize app:', err)
})
