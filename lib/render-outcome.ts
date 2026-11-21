import type {Job} from './live-render-core.ts'

export function elapsedLabel(startedAt: number, endedAt?: number): string {
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt! < startedAt) return 'ไม่ทราบระยะเวลา'
  const seconds = Math.floor((endedAt! - startedAt) / 1000)
  const minutes = Math.floor(seconds / 60)
  return minutes ? `${minutes} นาที ${seconds % 60} วินาที` : `${seconds} วินาที`
}
export const isTerminalJob = (job: Job) => ['succeeded', 'failed', 'cancelled'].includes(job.status)

/** Classify only known conditions; never expose raw model output or process logs to clients. */
export function codexFailureReason(message: string, fallback: string): string {
  if (/couldn[’']t save|could not save|unable to save|file.access restrictions|default location/i.test(message)) return 'output_not_saved'
  if (/not logged in|login required|authentication|unauthorized|401\b/i.test(message)) return 'codex_auth_required'
  if (/rate.limit|quota|usage.limit|429\b/i.test(message)) return 'codex_rate_limited'
  if (/image.{0,30}(?:tool|generation).{0,60}(?:unavailable|not available|not enabled)|(?:cannot|can't).{0,30}image.{0,15}generat/i.test(message)) return 'image_tool_unavailable'
  return fallback
}
