// Live render: create a job. Fail closed (see gateRequest). Never logs bodies or photos.
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {clientKey, gateRequest, INPUT_MAX_BYTES, sniffImage, type RenderImage, type StyleEntry} from '@/lib/live-render-core'
import {MAX_RENDER_BODY_BYTES, validateProductMeta} from '@/lib/product-render'
import {MAX_ROOM_REFERENCES, startJob} from '@/lib/live-render'
import {validateRenderInput} from '@/lib/render'
import {loadCatalog, loadRealCatalog} from '@/lib/catalog'
import {EXACT_LISTINGS} from '@/lib/listings'
import {listingTitles} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // the OpenAI job finishes inside this request's lifetime (waitUntil in lib/live-render.ts)

const FIELDS = ['image', 'styleReference', 'productImage', 'productMeta', 'meta', 'consent']
const headers = {'Cache-Control': 'no-store'}
const err = (status: number, code: string) => Response.json({error: {code}}, {status, headers})

/** A refusal to send back. Thrown by the helpers so the handler reads top to bottom. */
class Refusal { constructor(readonly status: number, readonly code: string) {} }
function refuse(status: number, code: string): never { throw new Refusal(status, code) }

function styleEntry(key: string): StyleEntry | null {
  const reg = JSON.parse(readFileSync(path.join(process.cwd(), 'prompts', 'registry.json'), 'utf8')) as {styles: StyleEntry[]}
  return reg.styles.find(s => s.key === key) ?? null
}

/** Whole body as one buffer, or null as soon as it exceeds `max` bytes (works without a Content-Length header). */
async function readCapped(stream: ReadableStream<Uint8Array>, max: number) {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) return Buffer.concat(chunks)
      size += value.byteLength
      if (size > max) { await reader.cancel(); return null }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
}

async function readForm(req: Request): Promise<FormData> {
  const type = req.headers.get('content-type') ?? ''
  if (!/^multipart\/form-data;/i.test(type)) refuse(415, 'unsupported_media_type')
  if (Number(req.headers.get('content-length') ?? 0) > MAX_RENDER_BODY_BYTES) refuse(413, 'body_too_large')
  if (!req.body) refuse(400, 'bad_form')
  const body = await readCapped(req.body, MAX_RENDER_BODY_BYTES).catch(() => refuse(400, 'bad_form'))
  if (!body) refuse(413, 'body_too_large')
  return new Response(body, {headers: {'Content-Type': type}}).formData().catch(() => refuse(400, 'bad_form'))
}

function jsonField(form: FormData, name: string, fallback: string, code: string): unknown {
  try { return JSON.parse(String(form.get(name) ?? fallback)) } catch { return refuse(400, code) }
}

type ImageCodes = {missing: string; size: [status: number, code: string]; type: string}
/** One uploaded image: a real file, within the size cap, and JPEG/PNG/WebP by magic bytes (never by its claimed type). */
async function readImage(entry: FormDataEntryValue, codes: ImageCodes): Promise<RenderImage> {
  if (!(entry instanceof File)) refuse(400, codes.missing)
  if (entry.size === 0 || entry.size > INPUT_MAX_BYTES) refuse(...codes.size)
  const image = Buffer.from(await entry.arrayBuffer())
  const kind = sniffImage(new Uint8Array(image.subarray(0, 16)))
  return kind ? {image, kind} : refuse(415, codes.type)
}

const ROOM_CODES: ImageCodes = {missing: 'image_required', size: [413, 'image_too_large'], type: 'image_not_jpeg_png_webp'}
const PRODUCT_CODES: ImageCodes = {missing: 'invalid_product_image', size: [400, 'invalid_product_image'], type: 'product_image_not_jpeg_png_webp'}
const STYLE_CODES: ImageCodes = {missing: 'style_reference_required', size: [413, 'style_reference_too_large'], type: 'style_reference_not_jpeg_png_webp'}

async function createJob(req: Request) {
  const gate = gateRequest(process.env, req.headers, 'POST')
  if (!gate.ok) refuse(gate.status, gate.code)
  const form = await readForm(req)
  if (form.get('consent') !== 'yes') refuse(400, 'consent_required')
  if ([...form.keys()].some(k => !FIELDS.includes(k))) refuse(400, 'unknown_field')

  const input = validateRenderInput(jsonField(form, 'meta', '', 'bad_meta'))
  if (!input.ok) refuse(input.error.status, input.error.code)
  const {styleId, items: placed} = input.input

  // SKU ids must be known catalog/fixture/exact-listing ids; names come from our data, never from the client
  const names = new Map<string, string>([
    ...loadCatalog().map(p => [p.id, p.name] as const),
    ...EXACT_LISTINGS.map(l => [l.id, l.title] as const),
    ...loadRealCatalog().map(p => [p.id, p.title] as const),
    // Neon listings picked on the Result page; DB down = only the CSV snapshot ids are allowed
    ...await listingTitles(placed.map(i => i.id).filter(id => id.startsWith('shopee-'))).catch(() => []),
  ])
  const productMeta = validateProductMeta(jsonField(form, 'productMeta', 'null', 'bad_product_meta'), placed.map(i => i.id), names)
    ?? refuse(400, 'invalid_product_references')
  const productUploads = form.getAll('productImage')
  if (productUploads.length !== productMeta.length) refuse(400, 'product_image_count_mismatch')
  const products = []
  for (const [i, upload] of productUploads.entries()) products.push({...productMeta[i], ...await readImage(upload, PRODUCT_CODES)})

  const style = styleEntry(styleId) ?? refuse(400, 'unsupported_style')

  const roomUploads = form.getAll('image')
  if (roomUploads.length < 1 || roomUploads.length > 1 + MAX_ROOM_REFERENCES) refuse(400, 'image_count_1_to_4')
  const rooms = []
  for (const upload of roomUploads) rooms.push(await readImage(upload, ROOM_CODES))

  const styleUploads = form.getAll('styleReference')
  if (styleUploads.length > 1) refuse(400, 'style_reference_count_max_1')
  const styleReference = styleUploads.length ? await readImage(styleUploads[0], STYLE_CODES) : undefined

  const started = await startJob({
    provider: gate.provider, clientKey: clientKey(req.headers), style, styleReference, products,
    room: rooms[0], roomReferences: rooms.slice(1),
    items: placed.map((item, i) => ({...item, name: productMeta[i].name})),
  })
  if (!started.ok) refuse(started.status, started.code)
  return Response.json({job: started.job, live: true}, {status: 202, headers})
}

export async function POST(req: Request) {
  try { return await createJob(req) } catch (e) {
    if (e instanceof Refusal) return err(e.status, e.code)
    throw e
  }
}
