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

export async function collectError(error: Error | any, type: 'content' | 'background') {
  const logs: ErrorLog[] = await getLogs();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  
  const existingIndex = logs.findIndex(log => log.message === message && log.stack === stack);
  
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
