// POST /api/scenes — build a 360 walkthrough from a finished render (LOCAL ONLY, see lib/scene-jobs.ts).
// multipart: job (render job id = scene id), products (JSON array of listing ids shown in the render),
//            before (optional: the user's room photo before staging; improves the product click masks)
import {sameOriginRefusal} from '@/lib/live-render-core'
import {FormRefusal, readCappedForm} from '@/lib/form-image'
import {sniffImage} from '@/lib/live-render-core'
import {readJob} from '@/lib/render-jobs'
import {listingsWithImages} from '@/lib/db'
import {storage} from '@/lib/storage'
import {isSceneId, scenesEnabled, startScene} from '@/lib/scene-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = {'Cache-Control': 'no-store'}
const err = (status: number, code: string) => Response.json({error: {code}}, {status, headers})
const LISTING = /^shopee-\d{1,20}-\d{1,20}$/
const MAX_PRODUCTS = 6

export async function POST(req: Request) {
  if (!scenesEnabled()) return err(404, 'scenes_disabled')
  const refused = sameOriginRefusal(req.headers, 'POST')
  if (refused) return err(403, refused)
  try {
    const form = await readCappedForm(req)
    const id = String(form.get('job') ?? '')
    if (!isSceneId(id)) return err(400, 'bad_job')
    let ids: unknown
    try { ids = JSON.parse(String(form.get('products') ?? '[]')) } catch { return err(400, 'bad_products') }
    if (!Array.isArray(ids) || ids.length > MAX_PRODUCTS || !ids.every(i => typeof i === 'string' && LISTING.test(i))) return err(400, 'bad_products')

    // the render comes from our own job row and bucket, never from the request
    const job = await readJob(id)
    if (job?.status !== 'succeeded' || !job.output) return err(409, 'render_not_ready')
    const render = Buffer.from(await (await storage().download(job.output.path)).bytes())

    const beforeEntry = form.get('before')
    let before: Buffer | null = null
    if (beforeEntry instanceof File && beforeEntry.size > 0) {
      const bytes = Buffer.from(await beforeEntry.arrayBuffer())
      if (!sniffImage(new Uint8Array(bytes.subarray(0, 16)))) return err(415, 'before_not_jpeg_png_webp')
      before = bytes
    }

    const rows = await listingsWithImages(ids as string[])
    const products = (ids as string[]).flatMap(pid => rows.filter(r => r.id === pid).map(r => ({
      id: r.id, title: r.title, url: r.url, price_thb: r.price_thb === null ? null : Number(r.price_thb),
    })))
    const started = await startScene({id, render, before, products})
    if (!started.ok) return err(started.status, started.code)
    return Response.json({id, scene: started.scene}, {status: 202, headers})
  } catch (e) {
    if (e instanceof FormRefusal) return err(e.status, e.code)
    console.error('scene start failed', (e as Error).message)
    return err(500, 'scene_failed')
  }
}
