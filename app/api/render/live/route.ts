// Live render: create a job. Local-only, fail closed (see gateRequest). Never logs bodies or photos.
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {gateRequest, INPUT_MAX_BYTES, sniffImage, type StyleEntry} from '@/lib/live-render-core'
import {MAX_RENDER_BODY_BYTES, validateProductMeta} from '@/lib/product-render'
import {startJob} from '@/lib/live-render'
import {validateRenderInput} from '@/lib/render'
import {loadCatalog, loadRealCatalog} from '@/lib/catalog'
import {EXACT_LISTINGS} from '@/lib/listings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = {'Cache-Control': 'no-store'}
const err = (status: number, code: string) => Response.json({error: {code}}, {status, headers})

function styleEntry(key: string): StyleEntry | null {
  const reg = JSON.parse(readFileSync(path.join(process.cwd(), 'prompts', 'registry.json'), 'utf8')) as {styles: StyleEntry[]}
  return reg.styles.find(s => s.key === key) ?? null
}

export async function POST(req: Request) {
  const gate = gateRequest(process.env, req.headers, 'POST')
  if (!gate.ok) return err(gate.status, gate.code)
  if (!/^multipart\/form-data;/i.test(req.headers.get('content-type') ?? '')) return err(415, 'unsupported_media_type')
  if (Number(req.headers.get('content-length') ?? 0) > MAX_RENDER_BODY_BYTES) return err(413, 'body_too_large')
  let form: FormData
  // Enforce the total byte cap even without a Content-Length header.
  try {
    if (!req.body) return err(400, 'bad_form')
    const reader = req.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const {done, value} = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_RENDER_BODY_BYTES) { await reader.cancel(); return err(413, 'body_too_large') }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    form = await new Response(Buffer.concat(chunks), {headers: {'Content-Type': req.headers.get('content-type')!}}).formData()
  } catch { return err(400, 'bad_form') }
  if (form.get('consent') !== 'yes') return err(400, 'consent_required')
  for (const k of form.keys()) if (!['image', 'styleReference', 'productImage', 'productMeta', 'meta', 'consent'].includes(k)) return err(400, 'unknown_field')

  let meta: unknown
  try { meta = JSON.parse(String(form.get('meta') ?? '')) } catch { return err(400, 'bad_meta') }
  const v = validateRenderInput(meta)
  if (!v.ok) return err(v.error.status, v.error.code)

  // SKU ids must be known catalog/fixture/exact-listing ids; names come from our data, never from the client
  const names = new Map<string, string>([...loadCatalog().map(p => [p.id, p.name] as const), ...EXACT_LISTINGS.map(l => [l.id, l.title] as const), ...loadRealCatalog().map(p => [p.id, p.title] as const)])
  let rawProducts: unknown
  try { rawProducts = JSON.parse(String(form.get('productMeta') ?? 'null')) } catch { return err(400, 'bad_product_meta') }
  const productMeta = validateProductMeta(rawProducts, v.input.items.map(i => i.id), names)
  if (!productMeta) return err(400, 'invalid_product_references')
  const productUploads = form.getAll('productImage')
  if (productUploads.length !== productMeta.length) return err(400, 'product_image_count_mismatch')
  const productReferences = []
  for (const [i, file] of productUploads.entries()) {
    if (!(file instanceof File) || file.size === 0 || file.size > INPUT_MAX_BYTES) return err(400, 'invalid_product_image')
    const image = Buffer.from(await file.arrayBuffer())
    const kind = sniffImage(new Uint8Array(image.subarray(0, 16)))
    if (!kind) return err(415, 'product_image_not_jpeg_png_webp')
    productReferences.push({...productMeta[i], image, kind})
  }
  const items = v.input.items.map((item, i) => ({...item, name: productMeta[i].name}))
  const style = styleEntry(v.input.styleId)
  if (!style) return err(400, 'unsupported_style')

  const files = form.getAll('image')
  if (files.length < 1 || files.length > 4) return err(400, 'image_count_1_to_4')
  const images = []
  for (const file of files) {
    if (!(file instanceof File)) return err(400, 'image_required')
    if (file.size === 0 || file.size > INPUT_MAX_BYTES) return err(413, 'image_too_large')
    const buf = Buffer.from(await file.arrayBuffer())
    const kind = sniffImage(new Uint8Array(buf.subarray(0, 16)))
    if (!kind) return err(415, 'image_not_jpeg_png_webp')
    images.push({image: buf, kind})
  }
  const styleFiles = form.getAll('styleReference')
  if (styleFiles.length > 1) return err(400, 'style_reference_count_max_1')
  let styleReference
  if (styleFiles.length) {
    const file = styleFiles[0]
    if (!(file instanceof File)) return err(400, 'style_reference_required')
    if (!file.size || file.size > INPUT_MAX_BYTES) return err(413, 'style_reference_too_large')
    const image = Buffer.from(await file.arrayBuffer())
    const kind = sniffImage(new Uint8Array(image.subarray(0, 16)))
    if (!kind) return err(415, 'style_reference_not_jpeg_png_webp')
    styleReference = {image, kind}
  }
  const started = await startJob(gate.provider, images[0].image, images[0].kind, style, items, images.slice(1), styleReference, productReferences)
  if (!started.ok) return err(started.status, started.code)
  return Response.json({job: started.job, live: true}, {status: 202, headers})
}
