import {DISMISSED_OUTCOME_PREFIX} from './storage-keys.ts'

// Memory fallback also survives page navigation if browser storage is unavailable.
const dismissed = new Set<string>()
export function isOutcomeDismissed(jobId: string): boolean {
  if (dismissed.has(jobId)) return true
  try { return localStorage.getItem(DISMISSED_OUTCOME_PREFIX + jobId) === '1' } catch { return false }
}
export function dismissOutcome(jobId: string): void {
  dismissed.add(jobId)
  try { localStorage.setItem(DISMISSED_OUTCOME_PREFIX + jobId, '1') } catch {}
}
