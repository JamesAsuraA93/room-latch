// Pure validation + mock for POST /api/render. No Next imports so Node tests can load it directly.
// The mock never receives, stores or forwards user photos: the "after" image is composited in the browser.
import {createHash} from 'node:crypto'

// Must equal STYLES ids in lib/demo.ts (asserted in scripts/render.test.mts). Duplicated because demo.ts is not Node-loadable.
export const RENDER_STYLES = ['minimal', 'muji', 'japandi', 'scandi', 'loft', 'luxe', 'boho', 'nordic'] as const
export const RENDER_ROOM_TYPES = ['condo', 'bedroom', 'living', 'empty', 'cluttered'] as const
export const PROMPT_VERSION = 'v1'
export const MAX_BODY_BYTES = 16 * 1024
export const MAX_ITEMS = 12

export type RenderItem = {id: string; x: number; y: number; w: number}
export type RenderInput = {styleId: string; roomType: string; budget: number; width: number; items: RenderItem[]}
export type RenderError = {status: number; code: string; message: string}
export type RenderResult = {ok: true; input: RenderInput} | {ok: false; error: RenderError}
export type RenderResponse = {
  status: 'completed'
  provider: 'mock'
  jobId: string
  promptVersion: string
  styleId: string
  after: {type: 'client-composite'; image: null; note: string}
  layout: {id: string; bbox: {x: number; y: number; w: number}}[]
  createdAt: string
}

const KEYS = ['styleId', 'roomType', 'budget', 'width', 'items']
const ITEM_KEYS = ['id', 'x', 'y', 'w']
const PHOTO_KEY = /photo|image|img|file|data_?url|base64|blob|upload|picture/i
const ID = /^[A-Za-z0-9_-]{1,80}$/

const fail = (code: string, message: string, status = 400): RenderResult => ({ok: false, error: {status, code, message}})
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const intIn = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi
const pct = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100

// Any photo-like key or data: URL anywhere in the body, at any depth.
function hasPhoto(v: unknown): boolean {
  if (typeof v === 'string') return v.trimStart().toLowerCase().startsWith('data:')
  if (Array.isArray(v)) return v.some(hasPhoto)
  if (isObj(v)) return Object.entries(v).some(([k, x]) => PHOTO_KEY.test(k) || hasPhoto(x))
  return false
}

/** Raw body text (already size-checked by caller or not) → validated input. */
export function parseRenderBody(text: string): RenderResult {
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return fail('body_too_large', `Body must be ≤ ${MAX_BODY_BYTES} bytes.`, 413)
  let body: unknown
  try { body = JSON.parse(text) } catch { return fail('bad_json', 'Body is not valid JSON.') }
  return validateRenderInput(body)
}

export function validateRenderInput(body: unknown): RenderResult {
  if (!isObj(body)) return fail('bad_json', 'Body must be a JSON object.')
  if (hasPhoto(body)) return fail('photo_not_accepted', 'This endpoint does not accept photos or data URLs. The room photo stays on your device.')
  const extra = Object.keys(body).filter(k => !KEYS.includes(k))
  if (extra.length) return fail('unknown_field', `Unknown field(s): ${extra.join(', ').slice(0, 200)}`)
  const {styleId, roomType, budget, width, items} = body
  if (typeof styleId !== 'string' || !(RENDER_STYLES as readonly string[]).includes(styleId)) return fail('unsupported_style', `styleId must be one of: ${RENDER_STYLES.join(', ')}`)
  if (typeof roomType !== 'string' || !(RENDER_ROOM_TYPES as readonly string[]).includes(roomType)) return fail('invalid_room_type', `roomType must be one of: ${RENDER_ROOM_TYPES.join(', ')}`)
  if (!intIn(budget, 1, 1_000_000)) return fail('invalid_number', 'budget must be an integer 1..1000000.')
  if (!intIn(width, 1, 1_000)) return fail('invalid_number', 'width must be an integer 1..1000 (cm).')
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return fail('invalid_items', `items must be an array of 0..${MAX_ITEMS}.`)
  for (const it of items) {
    if (!isObj(it) || Object.keys(it).some(k => !ITEM_KEYS.includes(k)) || typeof it.id !== 'string' || !ID.test(it.id) || !pct(it.x) || !pct(it.y) || !pct(it.w))
      return fail('invalid_items', 'Each item needs id ([A-Za-z0-9_-], 1..80) and x, y, w numbers 0..100.')
  }
  return {ok: true, input: {styleId, roomType, budget: budget as number, width: width as number, items: (items as RenderItem[]).map(({id, x, y, w}) => ({id, x, y, w}))}}
}

// Canonical = explicit key order built from validated values only.
export function jobIdFor(input: RenderInput): string {
  const canonical = JSON.stringify({promptVersion: PROMPT_VERSION, styleId: input.styleId, roomType: input.roomType, budget: input.budget, width: input.width, items: input.items.map(i => ({id: i.id, x: i.x, y: i.y, w: i.w}))})
  return createHash('sha256').update(canonical).digest('hex')
}

export function mockRender(input: RenderInput, now = new Date()): RenderResponse {
  return {
    status: 'completed',
    provider: 'mock',
    jobId: jobIdFor(input),
    promptVersion: PROMPT_VERSION,
    styleId: input.styleId,
    after: {type: 'client-composite', image: null, note: "Mock: no image generated. The app composites the user's local photo with product images in the browser."},
    layout: input.items.map(({id, x, y, w}) => ({id, bbox: {x, y, w}})),
    createdAt: now.toISOString(),
  }
}
