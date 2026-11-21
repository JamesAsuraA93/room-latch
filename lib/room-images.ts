// Keep the first photo compatible with existing demo/remix flows.
export const ROOM_IMAGES_KEY = 'room-ai-photos'
export const MAX_ROOM_IMAGES = 4
const PRIMARY_KEY = 'room-ai-photo'
export function readRoomImages(): string[] {
  try {
    const primary = sessionStorage.getItem(PRIMARY_KEY)
    if (!primary) return []
    const images: unknown = JSON.parse(sessionStorage.getItem(ROOM_IMAGES_KEY) || '[]')
    return Array.isArray(images) && images[0] === primary && images.every(i => typeof i === 'string')
      ? images.slice(0, MAX_ROOM_IMAGES) : [primary]
  } catch { return [] }
}
export function saveRoomImages(images: string[]): boolean {
  if (images.length > MAX_ROOM_IMAGES) return false
  const keys = [ROOM_IMAGES_KEY, PRIMARY_KEY]
  let previous: (string | null)[] = []
  try {
    previous = keys.map(k => sessionStorage.getItem(k))
    sessionStorage.setItem(ROOM_IMAGES_KEY, JSON.stringify(images))
    if (images[0]) sessionStorage.setItem(PRIMARY_KEY, images[0])
    else sessionStorage.removeItem(PRIMARY_KEY)
    sessionStorage.removeItem('room-ai-render')
    return true
  } catch {
    try { previous.forEach((v, i) => v === null ? sessionStorage.removeItem(keys[i]) : sessionStorage.setItem(keys[i], v)) } catch {}
    return false
  }
}
export const referenceCompleteness = (count: number) => Math.round(Math.max(0, Math.min(MAX_ROOM_IMAGES, count)) / MAX_ROOM_IMAGES * 100)
