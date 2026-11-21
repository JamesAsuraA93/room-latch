import assert from 'node:assert/strict'
import {decodeRoomImage, imageUploadError, isHeicFile, isImageFile, MAX_IMAGE_BYTES, resizeRoomImage} from '../lib/image.ts'

for (const file of [{name: 'IMG_1.HEIC', type: ''}, {name: 'photo.heif', type: 'application/octet-stream'}, {name: 'photo', type: 'image/heic'}]) {
  assert.ok(isHeicFile(file)); assert.ok(isImageFile(file))
}
assert.ok(isImageFile({name: 'camera.JPG', type: ''}))
assert.ok(!isImageFile({name: 'notes.txt', type: 'text/plain'}))

const saved = new Map(['createImageBitmap', 'Image', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
let closes = 0, conversions = 0, nativeHeic = false, drew = false
const canvas = {width: 0, height: 0, getContext: () => ({fillStyle: '', fillRect() {}, drawImage() { drew = true }}), toDataURL: (mime: string, quality: number) => { assert.equal(mime, 'image/jpeg'); assert.equal(quality, 0.85); return 'data:image/jpeg;base64,test' }}
Object.defineProperty(globalThis, 'document', {configurable: true, value: {createElement: () => canvas}})
Object.defineProperty(globalThis, 'Image', {configurable: true, value: class {
  onerror?: () => void
  set src(_value: string) { queueMicrotask(() => this.onerror?.()) }
}})
Object.defineProperty(globalThis, 'createImageBitmap', {configurable: true, value: async (blob: Blob, options: object) => {
  assert.deepEqual(options, {imageOrientation: 'from-image'})
  if (await blob.text() === 'broken' || (blob.type !== 'image/png' && blob.type !== 'image/jpeg' && !nativeHeic)) throw new Error('unsupported')
  return {width: 4000, height: 3000, close() { closes++ }}
}})
const heic = new File(['heic'], 'IMG_1.HEIC', {type: ''})
const convert = async () => { conversions++; return new Blob(['decoded'], {type: 'image/png'}) }
try {
  const decoded = await decodeRoomImage(heic, convert)
  assert.equal(conversions, 1, 'HEIC without a MIME type reaches the fallback converter')
  assert.equal(decoded.width, 4000); decoded.close(); assert.equal(closes, 1)
  nativeHeic = true
  const native = await decodeRoomImage(heic, convert)
  assert.equal(conversions, 1, 'native HEIC support does not load the converter'); native.close()
  nativeHeic = false
  await assert.rejects(decodeRoomImage(heic, async () => { throw new Error('bad HEIC') }), /แปลงรูป HEIC/)
  await assert.rejects(decodeRoomImage(new File(['broken'], 'bad.jpg', {type: 'image/jpeg'}), convert), /ไฟล์อาจเสีย/)
  assert.equal(conversions, 1, 'non-HEIC decode failures do not load the HEIC decoder')
  await assert.rejects(decodeRoomImage(new File([], 'empty.heic'), convert), /ไฟล์รูปว่าง/)
  const huge = new File(['heic'], 'huge.heic')
  Object.defineProperty(huge, 'size', {value: MAX_IMAGE_BYTES + 1})
  await assert.rejects(decodeRoomImage(huge, convert), /30 MB/)
  assert.equal(conversions, 1, 'size validation happens before decoding')
  const result = await resizeRoomImage(new File(['jpeg'], 'room.jpg', {type: 'image/jpeg'}), 1200)
  assert.match(result, /^data:image\/jpeg/); assert.equal(canvas.width, 1200); assert.equal(canvas.height, 900)
  assert.ok(drew); assert.equal(closes, 3, 'bitmap resources released after resizing')
  assert.match(imageUploadError(new Error('storage quota')), /บันทึกรูปไม่ได้/)
  console.log('Image validation, HEIC fallback routing, orientation, resizing and cleanup passed')
} finally {
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
}
