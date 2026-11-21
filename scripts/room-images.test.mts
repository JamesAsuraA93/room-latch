import {readStyleReference, saveStyleReference, STYLE_REFERENCE_KEY} from '../lib/style-reference.ts'
import assert from 'node:assert/strict'
import {readRoomImages, saveRoomImages, referenceCompleteness} from '../lib/room-images.ts'
const values = new Map<string, string>()
let rejectKey = ''
Object.defineProperty(globalThis, 'sessionStorage', {value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { if (key === rejectKey) throw new Error('quota'); values.set(key, value) },
  removeItem: (key: string) => values.delete(key),
}, configurable: true})
assert.deepEqual(readRoomImages(), [])
assert.equal(saveRoomImages(['a', 'b', 'c', 'd']), true)
assert.deepEqual(readRoomImages(), ['a', 'b', 'c', 'd'])
assert.equal(saveRoomImages(['a', 'b', 'c', 'd', 'e']), false)
assert.deepEqual(readRoomImages(), ['a', 'b', 'c', 'd'])
assert.equal(saveRoomImages(['b', 'a', 'c']), true)
assert.equal(values.get('room-ai-photo'), 'b')
rejectKey = 'room-ai-photo'
assert.equal(saveRoomImages(['new']), false)
assert.deepEqual(readRoomImages(), ['b', 'a', 'c'], 'failed storage write restores old references')
rejectKey = ''
values.set('room-ai-photo', 'remix')
assert.deepEqual(readRoomImages(), ['remix'], 'legacy/remix photo does not inherit old room references')
assert.equal(saveRoomImages([]), true)
assert.deepEqual(readRoomImages(), [])
assert.deepEqual([0, 1, 2, 3, 4, 5].map(referenceCompleteness), [0, 25, 50, 75, 100, 100])
console.log('room image persistence, cap, removal, main image, rollback and scoring ok')

assert.equal(saveRoomImages(['room-1', 'room-2', 'room-3', 'room-4']), true)
assert.equal(saveStyleReference('inspiration'), true)
assert.equal(readStyleReference(), 'inspiration')
assert.equal(readRoomImages().length, 4, 'style reference is additional to four room images')
rejectKey = STYLE_REFERENCE_KEY
assert.equal(saveStyleReference('replacement'), false)
assert.equal(readStyleReference(), 'inspiration', 'failed replacement preserves prior reference')
rejectKey = ''
assert.equal(saveStyleReference(''), true)
assert.equal(readStyleReference(), '')
assert.equal(readRoomImages().length, 4, 'removing style inspiration preserves room images')
console.log('custom reference storage isolation and replacement ok')
