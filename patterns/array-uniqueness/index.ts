/**
 * Extracted from: {{PROJECT_NAME}}
 * Utility to filter an array and keep only unique items based on JSON serialization.
 */
export function getUniqueItems<T>(items: T[]): T[] {
  return [...new Set(items.map(item => JSON.stringify(item)))].map(s => JSON.parse(s) as T);
}
