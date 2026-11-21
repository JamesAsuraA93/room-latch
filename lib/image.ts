/**
 * ย่อรูปก่อนส่งขึ้น API ด้านยาวไม่เกิน 1600px
 * createImageBitmap({imageOrientation:'from-image'}) หมุนรูปตาม EXIF ให้เอง
 * ถ้าเทสต์บน iOS Safari รุ่นเก่าแล้วรูปยังหมุนผิด ค่อยกลับมาอ่าน EXIF เองตรงนี้
 */
export async function resizeRoomImage(file: File, maxSide = 1600): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('invalid')
  const bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'})
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}
