import {FLOOR_PLAN_KEY} from './storage-keys.ts'

export function readFloorPlan(): string {
  try { return sessionStorage.getItem(FLOOR_PLAN_KEY) || '' } catch { return '' }
}
export function saveFloorPlan(image: string): boolean {
  try {
    if (image) sessionStorage.setItem(FLOOR_PLAN_KEY, image)
    else sessionStorage.removeItem(FLOOR_PLAN_KEY)
    return true
  } catch { return false }
}

/** Empty is optional; a supplied area must be a positive square-metre value. */
export function parseRoomArea(raw: unknown): {ok: true; value?: number} | {ok: false} {
  if (raw === undefined || raw === null || raw === '') return {ok: true}
  if (typeof raw !== 'string' && typeof raw !== 'number') return {ok: false}
  if (!/^\d*(?:\.\d{1,2})?$/.test(String(raw))) return {ok: false}
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 && value <= 10000 ? {ok: true, value} : {ok: false}
}
