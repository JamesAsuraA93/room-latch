import type {Furniture} from './furniture.ts'
import type {Job} from './live-render-core.ts'
import {DESIGN_JOB_KEY, FURNITURE_SELECTION_KEY} from './storage-keys.ts'

export type DesignSelection = {context: string; items: Furniture[]}
export type DesignSession = {
  job: Job; items: Furniture[]; plan: {style: string; roomType: string; budget: number; width: number; areaM2?: number | null; need?: string}
  before: string; photoCount: number
}

export function readSelection(): DesignSelection | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(FURNITURE_SELECTION_KEY) || 'null')
    return value && typeof value.context === 'string' && Array.isArray(value.items) ? value : null
  } catch { return null }
}
export function saveSelection(value: DesignSelection): boolean {
  try { sessionStorage.setItem(FURNITURE_SELECTION_KEY, JSON.stringify(value)); return true } catch { return false }
}
export function readDesignSession(): DesignSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(DESIGN_JOB_KEY) || 'null')
    return value?.job && /^[A-Za-z0-9-]+$/.test(value.job.id) && Array.isArray(value.items) && value.plan && typeof value.before === 'string' ? value : null
  } catch { return null }
}
export function saveDesignSession(value: DesignSession): boolean {
  try { sessionStorage.setItem(DESIGN_JOB_KEY, JSON.stringify(value)); return true } catch { return false }
}
