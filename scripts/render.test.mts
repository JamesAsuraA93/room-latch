// รัน: node scripts/render.test.mts
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {RENDER_STYLES, RENDER_ROOM_TYPES, parseRenderBody, validateRenderInput, mockRender, jobIdFor, type RenderInput} from '../lib/render.ts'

const ok: RenderInput = {styleId: 'japandi', roomType: 'condo', budget: 5000, width: 80, items: [{id: 'desk-1', x: 10, y: 50, w: 40}, {id: 'lamp_2', x: 0, y: 100, w: 12.5}]}
const code = (body: unknown) => { const r = validateRenderInput(body); assert.equal(r.ok, false, JSON.stringify(body)); return r.ok ? '' : r.error.code }

// valid → completed mock shape
const r = validateRenderInput(ok)
assert.ok(r.ok)
const res = mockRender(r.input, new Date('2026-11-21T00:00:00Z'))
assert.equal(res.status, 'completed'); assert.equal(res.provider, 'mock'); assert.equal(res.promptVersion, 'v1'); assert.equal(res.styleId, 'japandi')
assert.match(res.jobId, /^[0-9a-f]{64}$/)
assert.deepEqual(res.after, {type: 'client-composite', image: null, note: "Mock: no image generated. The app composites the user's local photo with product images in the browser."})
assert.deepEqual(res.layout, [{id: 'desk-1', bbox: {x: 10, y: 50, w: 40}}, {id: 'lamp_2', bbox: {x: 0, y: 100, w: 12.5}}])
assert.equal(res.createdAt, '2026-11-21T00:00:00.000Z')
assert.ok(validateRenderInput({...ok, items: []}).ok)
assert.ok(parseRenderBody(JSON.stringify(ok)).ok)

// deterministic jobId; key order in the request does not matter
const reordered = {items: ok.items.map(({w, y, x, id}) => ({w, y, x, id})), width: 80, budget: 5000, roomType: 'condo', styleId: 'japandi'}
const r2 = validateRenderInput(reordered); assert.ok(r2.ok)
assert.equal(jobIdFor(r2.input), res.jobId)
assert.notEqual(jobIdFor({...ok, budget: 5001}), res.jobId)

// bad cases
assert.equal(code({...ok, styleId: 'gothic'}), 'unsupported_style')
assert.equal(code({...ok, roomType: 'kitchen'}), 'invalid_room_type')
for (const budget of [0, 10.5, 1_000_001, '5000', NaN]) assert.equal(code({...ok, budget}), 'invalid_number')
for (const width of [0, 80.5, 1001, -1]) assert.equal(code({...ok, width}), 'invalid_number')
assert.equal(code({...ok, items: Array.from({length: 13}, (_, i) => ({id: `i${i}`, x: 1, y: 1, w: 1}))}), 'invalid_items')
assert.equal(code({...ok, items: 'x'}), 'invalid_items')
assert.equal(code({...ok, items: [{id: 'bad id!', x: 1, y: 1, w: 1}]}), 'invalid_items')
assert.equal(code({...ok, items: [{id: 'a'.repeat(81), x: 1, y: 1, w: 1}]}), 'invalid_items')
assert.equal(code({...ok, items: [{id: 'a', x: 101, y: 1, w: 1}]}), 'invalid_items')
assert.equal(code({...ok, items: [{id: 'a', x: NaN, y: 1, w: 1}]}), 'invalid_items')
assert.equal(code({...ok, items: [{id: 'a', x: 1, y: 1, w: 1, z: 2}]}), 'invalid_items')
assert.equal(code({...ok, extra: 1}), 'unknown_field')
for (const k of ['photo', 'image', 'file', 'dataUrl']) assert.equal(code({...ok, [k]: 'x'}), 'photo_not_accepted', k)
assert.equal(code({...ok, items: [{id: 'a', x: 1, y: 1, w: 1, photo: 'x'}]}), 'photo_not_accepted')
assert.equal(code({...ok, styleId: 'data:image/png;base64,AAAA'}), 'photo_not_accepted')
assert.equal(code({...ok, items: [{id: 'data:image/png;base64,AAAA', x: 1, y: 1, w: 1}]}), 'photo_not_accepted')
assert.equal(code([ok]), 'bad_json')
assert.equal(code(null), 'bad_json')
const empty = parseRenderBody(''); assert.ok(!empty.ok && empty.error.code === 'bad_json' && empty.error.status === 400)
const big = parseRenderBody(JSON.stringify({...ok, pad: 'x'.repeat(17000)})); assert.ok(!big.ok && big.error.status === 413)

// allowlists match the UI (same parse as plan.test.mts)
const demoSrc = readFileSync(new URL('../lib/demo.ts', import.meta.url), 'utf8')
const styleIds = [...demoSrc.slice(demoSrc.indexOf('export const STYLES'), demoSrc.indexOf('] as const')).matchAll(/id: '(\w+)'/g)].map(m => m[1])
assert.deepEqual([...RENDER_STYLES], styleIds)
const rooms = demoSrc.match(/export const ROOM_TYPES = \[([^\]]*)\]/)![1].match(/'(\w+)'/g)!.map(s => s.slice(1, -1))
assert.deepEqual([...RENDER_ROOM_TYPES], rooms)
console.log('render ok')
