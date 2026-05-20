import type { ProtocolWithReturn } from 'webext-bridge'
import type { Mark } from '~/logic/storage'
import type { RangySelection, RangyRange } from 'rangy/lib/rangy-core'
import type { RangyClassApplier } from 'rangy/lib/rangy-classapplier'
declare module 'webext-bridge' {
  export interface ProtocolMap {
    // define message protocol types
    // see https://github.com/antfu/webext-bridge#type-safe-protocols
    'tab-prev': { title: string | undefined }
    'open-sidepanel': ProtocolWithReturn<{ tabId?: number }, { success: boolean; browser: string; error?: string }>
    'get-current-tab': ProtocolWithReturn<{ tabId: number }, { title?: string }>
    'get-marks-for-url': ProtocolWithReturn<{ url: string }, Mark[]>
    'get-mark-by-id': ProtocolWithReturn<{ id: string; url: string }, Mark>
    'remove-mark-by-id': ProtocolWithReturn<{ id: string; url: string }, { success: boolean; error?: string }>
    'update-mark-note': ProtocolWithReturn<{ id: string; url: string; note: string }, { success: boolean; error?: string }>
    'update-mark-details': ProtocolWithReturn<{ id: string; url: string; note?: string; color?: string; tags?: string[]; [key: string]: any }, { success: boolean; error?: string }>
    'add-mark': ProtocolWithReturn<Mark, { success: boolean; error?: string }>
    'remove-mark': ProtocolWithReturn<Mark, { success: boolean; error?: string }>
    'goto-mark': { markId: string }
    'get-storage-usage': ProtocolWithReturn<void, { usage: number; quota: number }>
    'cleanup-old-marks': ProtocolWithReturn<{ days: number }, { success: boolean; error?: string }>
    'cleanup-useless-marks': ProtocolWithReturn<void, { success: boolean; error?: string }>
    'goto-chapter': ProtocolWithReturn<{ selector: string }>
    'open-options-page'
  }
}
