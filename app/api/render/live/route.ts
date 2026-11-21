// Live render: create a job. Fail closed (see gateRequest). Never logs bodies or photos.
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {clientKey, gateRequest, INPUT_MAX_BYTES, sameOriginRefusal, sniffImage, type RenderImage, type StyleEntry} from '@/lib/live-render-core'
import {renderReadiness} from '@/lib/render-readiness'
import {MAX_RENDER_BODY_BYTES, validateProductMeta} from '@/lib/product-render'
import {MAX_ROOM_REFERENCES, startJob} from '@/lib/live-render'
import {validateRenderInput} from '@/lib/render'
import {loadCatalog, loadRealCatalog} from '@/lib/catalog'
import {EXACT_LISTINGS} from '@/lib/listings'
import {listingAssets} from '@/lib/db'
import type {PipelineProduct} from '@/lib/render-pipeline'
import {loadFurnitureCatalog} from '@/lib/furniture-catalog'
import {validateFurnitureIds} from '@/lib/furniture'
import {isListingImageUrl} from '@/lib/listing-image'
import {parseRoomArea} from '@/lib/floor-plan'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // the OpenAI job finishes inside this request's lifetime (waitUntil in lib/live-render.ts)

const FIELDS = ['image', 'floorPlan', 'roomArea', 'styleReference', 'productImage', 'productMeta', 'meta', 'consent', 'mode']
const headers = {'Cache-Control': 'no-store'}
const err = (status: number, code: string) => Response.json({error: {code}}, {status, headers})

/** Read-only readiness check; does not start a job or spend model credits. */
export async function GET(req: Request) {
  const refused = sameOriginRefusal(req.headers, 'GET')
  if (refused) return err(403, refused)
  return Response.json(renderReadiness(process.env), {headers})
}

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
const FLOOR_CODES: ImageCodes = {missing: 'invalid_floor_plan', size: [413, 'floor_plan_too_large'], type: 'floor_plan_not_jpeg_png_webp'}

async function createJob(req: Request) {
  const gate = gateRequest(process.env, req.headers, 'POST')
  if (!gate.ok) refuse(gate.status, gate.code)
  const form = await readForm(req)
  if (form.get('consent') !== 'yes') refuse(400, 'consent_required')
  if ([...form.keys()].some(k => !FIELDS.includes(k))) refuse(400, 'unknown_field')

  const input = validateRenderInput(jsonField(form, 'meta', '', 'bad_meta'))
  if (!input.ok) refuse(input.error.status, input.error.code)
  const {styleId, items: placed} = input.input

  const style = styleEntry(styleId) ?? refuse(400, 'unsupported_style')

  const roomUploads = form.getAll('image')
  if (roomUploads.length < 1 || roomUploads.length > 1 + MAX_ROOM_REFERENCES) refuse(400, 'image_count_1_to_4')
  const rooms = []
  for (const upload of roomUploads) rooms.push(await readImage(upload, ROOM_CODES))

  const styleUploads = form.getAll('styleReference')
  if (styleUploads.length > 1) refuse(400, 'style_reference_count_max_1')
  const styleReference = styleUploads.length ? await readImage(styleUploads[0], STYLE_CODES) : undefined
  const floorUploads = form.getAll('floorPlan')
  if (floorUploads.length > 1) refuse(400, 'floor_plan_count_max_1')
  const floorPlan = floorUploads.length ? await readImage(floorUploads[0], FLOOR_CODES) : undefined
  if (form.getAll('roomArea').length > 1) refuse(400, 'invalid_room_area')
  const area = parseRoomArea(form.get('roomArea'))
  if (!area.ok) refuse(400, 'invalid_room_area')

  const mode = form.get('mode')
  if (mode !== null && mode !== 'selection') refuse(400, 'invalid_mode')
  let products: PipelineProduct[] = []
  let productNames: string[] = []
  if (mode === 'selection') {
    if (form.has('productImage') || form.has('productMeta')) refuse(400, 'unknown_field')
    // Resolve ids, names and image URLs from our own catalog; never fetch a client-provided URL.
    const catalog = await loadFurnitureCatalog()
    const assets = new Map((await listingAssets(placed.map(p => p.id).filter(id => id.startsWith('shopee-'))).catch(() => [])).map(p => [p.id, p]))
    const known = new Map([...catalog.map(p => [p.id, p.name] as const), ...[...assets.values()].map(p => [p.id, p.title] as const)])
    if (!validateFurnitureIds(placed.map(p => p.id), known)) refuse(400, 'invalid_product_references')
    productNames = placed.map(p => known.get(p.id)!)
    products = placed.map(p => {
      const asset = assets.get(p.id)
      const item = catalog.find(candidate => candidate.id === p.id)
      const listing = asset ? {imagePath: asset.imagePath, imageUrl: asset.imageUrl, dimensions: asset.dimensions}
        : item?.image && isListingImageUrl(item.image) ? {imagePath: null, imageUrl: item.image, dimensions: null} : undefined
      return {id: p.id, name: known.get(p.id)!, listing}
    })
  } else {
    // SKU ids must be known catalog/fixture/exact-listing ids; names come from our data, never from the client
    // Neon listings picked on the Result page; DB down = only the CSV snapshot ids are allowed and listing photos are unavailable
    const listings = new Map((await listingAssets(placed.map(i => i.id).filter(id => id.startsWith('shopee-'))).catch(() => [])).map(l => [l.id, l]))
    const names = new Map<string, string>([
      ...loadCatalog().map(p => [p.id, p.name] as const),
      ...EXACT_LISTINGS.map(l => [l.id, l.title] as const),
      ...loadRealCatalog().map(p => [p.id, p.title] as const),
      ...[...listings.values()].map(l => [l.id, l.title] as const),
    ])
    const productMeta = validateProductMeta(jsonField(form, 'productMeta', 'null', 'bad_product_meta'), placed.map(i => i.id), names)
      ?? refuse(400, 'invalid_product_references')
    const productUploads = form.getAll('productImage')
    if (productUploads.length !== productMeta.filter(m => m.source === 'upload').length) refuse(400, 'product_image_count_mismatch')
    productNames = productMeta.map(p => p.name)
    let nextUpload = 0
    for (const {id, name, widthCm, source} of productMeta) {
      if (source === 'upload') { products.push({id, name, widthCm, upload: await readImage(productUploads[nextUpload++], PRODUCT_CODES)}); continue }
      const listing = listings.get(id)
      if (!listing?.imagePath && !listing?.imageUrl) refuse(422, 'listing_photo_missing')
      products.push({id, name, widthCm, listing: {imagePath: listing!.imagePath, imageUrl: listing!.imageUrl, dimensions: listing!.dimensions}})
    }
  }

  const started = await startJob({
    provider: gate.provider, clientKey: clientKey(req.headers), style, styleReference, products, floorPlan, roomAreaM2: area.value,
    room: rooms[0], roomReferences: rooms.slice(1),
    roomType: input.input.roomType, widthCm: mode === 'selection' ? undefined : input.input.width,
    items: placed.map((item, i) => ({...item, name: productNames[i]})),
  })
  if (!started.ok) refuse(started.status, started.code)
  return Response.json({job: started.job, live: true, productPhotoCount: started.productPhotoCount ?? products.length}, {status: 202, headers})
}

export async function POST(req: Request) {
  try { return await createJob(req) } catch (e) {
    if (e instanceof Refusal) return err(e.status, e.code)
    throw e
  }
}
