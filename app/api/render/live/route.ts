// Live render: create a job. Local-only, fail closed (see gateRequest). Never logs bodies or photos.
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {gateRequest, INPUT_MAX_BYTES, sniffImage, type StyleEntry} from '@/lib/live-render-core'
import {startJob} from '@/lib/live-render'
import {validateRenderInput} from '@/lib/render'
import {loadCatalog, loadRealCatalog} from '@/lib/catalog'
import {EXACT_LISTINGS} from '@/lib/listings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = {'Cache-Control': 'no-store'}
const err = (status: number, code: string) => Response.json({error: {code}}, {status, headers})

function styleEntry(key: string): StyleEntry | null {
  const reg = JSON.parse(readFileSync(path.join(process.cwd(), '..', 'docs', 'prompts', 'registry.json'), 'utf8')) as {styles: StyleEntry[]}
  return reg.styles.find(s => s.key === key) ?? null
}

export async function POST(req: Request) {
  const gate = gateRequest(process.env, req.headers, 'POST')
  if (!gate.ok) return err(gate.status, gate.code)
  if (!/^multipart\/form-data;/i.test(req.headers.get('content-type') ?? '')) return err(415, 'unsupported_media_type')
  if (Number(req.headers.get('content-length') ?? 0) > INPUT_MAX_BYTES + 64 * 1024) return err(413, 'body_too_large')
  let form: FormData
  try { form = await req.formData() } catch { return err(400, 'bad_form') }
  if (form.get('consent') !== 'yes') return err(400, 'consent_required')
  for (const k of form.keys()) if (!['image', 'meta', 'consent'].includes(k)) return err(400, 'unknown_field')

  let meta: unknown
  try { meta = JSON.parse(String(form.get('meta') ?? '')) } catch { return err(400, 'bad_meta') }
  const v = validateRenderInput(meta)
  if (!v.ok) return err(v.error.status, v.error.code)

  // SKU ids must be known catalog/fixture/exact-listing ids; names come from our data, never from the client
  const names = new Map<string, string>([...loadCatalog().map(p => [p.id, p.name] as const), ...EXACT_LISTINGS.map(l => [l.id, l.title] as const), ...loadRealCatalog().map(p => [p.id, p.title] as const)])
  const items = []
  for (const it of v.input.items) {
    const name = names.get(it.id)
    if (!name) return err(400, 'unknown_item')
    items.push({...it, name})
  }
  const style = styleEntry(v.input.styleId)
  if (!style) return err(400, 'unsupported_style')

  const file = form.get('image')
  if (!(file instanceof File)) return err(400, 'image_required')
  if (file.size === 0 || file.size > INPUT_MAX_BYTES) return err(413, 'image_too_large')
  const buf = Buffer.from(await file.arrayBuffer())
  const kind = sniffImage(new Uint8Array(buf.subarray(0, 16)))
  if (!kind) return err(415, 'image_not_jpeg_png_webp')

  const started = await startJob(gate.provider, buf, kind, style, items)
  if (!started.ok) return err(started.status, started.code)
  return Response.json({job: started.job, live: true}, {status: 202, headers})
}
