export const STYLE_REFERENCE_KEY = 'room-ai-style-reference'
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
