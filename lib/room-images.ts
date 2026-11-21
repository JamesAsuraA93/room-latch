import {RENDER_KEY, ROOM_IMAGE_KEY, ROOM_IMAGES_KEY} from './storage-keys.ts'

// Keep the first photo compatible with existing demo/remix flows.
export const MAX_ROOM_IMAGES = 4
export function readRoomImages(): string[] {
  try {
    const primary = sessionStorage.getItem(ROOM_IMAGE_KEY)
    if (!primary) return []
    const images: unknown = JSON.parse(sessionStorage.getItem(ROOM_IMAGES_KEY) || '[]')
    return Array.isArray(images) && images[0] === primary && images.every(i => typeof i === 'string')
      ? images.slice(0, MAX_ROOM_IMAGES) : [primary]
  } catch { return [] }
}
export function saveRoomImages(images: string[]): boolean {
  if (images.length > MAX_ROOM_IMAGES) return false
  const keys = [ROOM_IMAGES_KEY, ROOM_IMAGE_KEY]
  let previous: (string | null)[] = []
  try {
    previous = keys.map(k => sessionStorage.getItem(k))
    sessionStorage.setItem(ROOM_IMAGES_KEY, JSON.stringify(images))
    if (images[0]) sessionStorage.setItem(ROOM_IMAGE_KEY, images[0])
    else sessionStorage.removeItem(ROOM_IMAGE_KEY)
    sessionStorage.removeItem(RENDER_KEY)
    return true
  } catch {
    try { previous.forEach((v, i) => v === null ? sessionStorage.removeItem(keys[i]) : sessionStorage.setItem(keys[i], v)) } catch {}
    return false
  }
}
export const referenceCompleteness = (count: number) => Math.round(Math.max(0, Math.min(MAX_ROOM_IMAGES, count)) / MAX_ROOM_IMAGES * 100)
