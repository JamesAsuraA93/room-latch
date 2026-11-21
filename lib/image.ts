export const IMAGE_ACCEPT = 'image/*,.heic,.heif'
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024
type ImageFile = Pick<File, 'name' | 'type'>
export const isHeicFile = (file: ImageFile) => /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf](?:-sequence)?$/i.test(file.type)
export const isImageFile = (file: ImageFile) => file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(file.name)

export class ImageUploadError extends Error {}
export const imageUploadError = (error: unknown) => error instanceof ImageUploadError ? error.message : 'บันทึกรูปไม่ได้ กรุณาลองรูปขนาดเล็กลง'

type DecodedImage = {source: CanvasImageSource; width: number; height: number; close: () => void}
async function decodeNative(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, {imageOrientation: 'from-image'})
      return {source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close()}
    } catch { /* Safari may support an image through <img> but not createImageBitmap. */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => resolve({source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url)})
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')) }
    image.src = url
  })
}

async function convertHeic(file: Blob): Promise<Blob> {
  // Lazy-loaded on this device; the original photo is not sent to a conversion service.
  const {heicTo} = await import('heic-to/csp')
  return heicTo({blob: file, type: 'image/png'})
}

export async function decodeRoomImage(file: File, heicDecoder: (file: Blob) => Promise<Blob> = convertHeic): Promise<DecodedImage> {
  if (!isImageFile(file)) throw new ImageUploadError('กรุณาเลือกไฟล์รูปภาพ JPG, PNG, WebP หรือ HEIC')
  if (!file.size) throw new ImageUploadError('ไฟล์รูปว่าง กรุณาเลือกรูปใหม่')
  if (file.size > MAX_IMAGE_BYTES) throw new ImageUploadError('รูปใหญ่เกิน 30 MB กรุณาเลือกรูปขนาดเล็กลง')
  try { return await decodeNative(file) } catch {
    if (!isHeicFile(file)) throw new ImageUploadError('อ่านรูปไม่ได้ ไฟล์อาจเสีย กรุณาเลือกรูปใหม่')
  }
  try { return await decodeNative(await heicDecoder(file)) } catch {
    throw new ImageUploadError('แปลงรูป HEIC ไม่สำเร็จ กรุณาลองใหม่ หรือส่งออกเป็น JPG แล้วเลือกอีกครั้ง')
  }
}

/** Decode HEIC when needed, apply orientation and save a compact JPEG for preview and rendering. */
export async function resizeRoomImage(file: File, maxSide = 1600): Promise<string> {
  const image = await decodeRoomImage(file)
  try {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new ImageUploadError('เตรียมรูปไม่ได้ กรุณาลองใหม่')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    image.close()
  }
}
