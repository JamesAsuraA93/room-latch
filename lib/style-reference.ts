import {STYLE_REFERENCE_KEY} from './storage-keys.ts'

export {STYLE_REFERENCE_KEY}
export function readStyleReference(): string {
  try { return sessionStorage.getItem(STYLE_REFERENCE_KEY) || '' } catch { return '' }
}
export function saveStyleReference(image: string): boolean {
  try {
    if (image) sessionStorage.setItem(STYLE_REFERENCE_KEY, image)
    else sessionStorage.removeItem(STYLE_REFERENCE_KEY)
    return true
  } catch { return false }
}
