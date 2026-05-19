export interface ErrorLog {
  timestamp: number;
  message: string;
  stack?: string;
  context: {
    url: string;
    version: string;
    type: 'content' | 'background';
  };
  count: number;
}

export const STORAGE_KEY = 'webmarker_error_logs';
export const MAX_LOGS = 50;

/**
 * 采集并过滤错误。
 * @param error 可以是 Error 对象、ErrorEvent、PromiseRejectionEvent 或任何其它错误信息。
 * @param type 错误发生的上下文（content script 或 background）。
 */
export async function collectError(error: any, type: 'content' | 'background') {
  const extensionOrigin = chrome.runtime.getURL('')

  let message = ''
  let stack = ''
  let filename = ''

  // 提取错误信息、堆栈和文件名
  if (error instanceof Error) {
    message = error.message
    stack = error.stack || ''
  }
  else if (typeof ErrorEvent !== 'undefined' && error instanceof ErrorEvent) {
    message = error.message
    filename = error.filename || ''
    if (error.error instanceof Error)
      stack = error.error.stack || ''
  }
  else if (typeof PromiseRejectionEvent !== 'undefined' && error instanceof PromiseRejectionEvent) {
    const reason = error.reason
    message = reason instanceof Error ? reason.message : String(reason)
    stack = reason instanceof Error ? (reason.stack || '') : ''
  }
  else if (error && typeof error === 'object') {
    message = error.message || String(error)
    stack = error.stack || ''
    filename = error.filename || ''
  }
  else {
    message = String(error)
  }

  // 核心过滤逻辑：只记录来自插件源的错误
  const isFromExtension = (stack && stack.includes(extensionOrigin)) || 
                          (filename && filename.includes(extensionOrigin))

  if (!isFromExtension)
    return

  const logs: ErrorLog[] = await getLogs()
  
  const existingIndex = logs.findIndex(log => log.message === message && log.stack === stack)
  
  if (existingIndex !== -1) {
    logs[existingIndex].count += 1;
    logs[existingIndex].timestamp = Date.now();
  } else {
    logs.unshift({
      timestamp: Date.now(),
      message,
      stack,
      context: {
        url: typeof window !== 'undefined' ? window.location.href : 'N/A',
        version: '1.0.0',
        type
      },
      count: 1
    });
  }
  
  if (logs.length > MAX_LOGS) logs.pop();
  await chrome.storage.local.set({ [STORAGE_KEY]: logs });
}

export async function getLogs(): Promise<ErrorLog[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}
