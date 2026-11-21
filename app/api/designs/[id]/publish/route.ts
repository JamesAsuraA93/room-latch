import sharp from 'sharp'
import {currentUser} from '@/lib/auth'
import {db} from '@/lib/db'
import {sameOriginRefusal, sniffImage} from '@/lib/live-render-core'
import {isDesignId, parsePublishMeta, PUBLISH_MAX_BYTES, publishDesign, PublishError} from '@/lib/publish-design'
import {storage} from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const headers = {'Cache-Control': 'no-store'}
const fail = (code: string, status: number) => Response.json({error: code}, {status, headers})

export async function POST(req: Request, {params}: {params: Promise<{id: string}>}) {
  const refused = sameOriginRefusal(req.headers, 'POST')
  if (refused) return fail(refused, 403)
  const {id} = await params
  if (!isDesignId(id)) return fail('invalid_design', 400)
  try {
    const user = await currentUser()
    if (!user) return fail('sign_in_required', 401)
    if (!req.headers.get('content-type')?.startsWith('multipart/form-data;')) return fail('invalid_form', 415)
    if (!req.body || Number(req.headers.get('content-length')) > PUBLISH_MAX_BYTES) return fail('image_too_large', 413)
    // Cap actual streamed bytes as Content-Length can be absent or untrusted.
    const reader = req.body.getReader(), chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const {done, value} = await reader.read()
        if (done) break
        size += value.length
        if (size > PUBLISH_MAX_BYTES) { await reader.cancel(); return fail('image_too_large', 413) }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    let form: FormData
    try { form = await new Response(Buffer.concat(chunks), {headers: {'Content-Type': req.headers.get('content-type')!}}).formData() }
    catch { return fail('invalid_form', 400) }
    if (form.get('consent') !== 'publish-before-after') return fail('consent_required', 400)
    let meta
    try { meta = parsePublishMeta(JSON.parse(String(form.get('meta')))) } catch { return fail('invalid_plan', 400) }
    if (!meta) return fail('invalid_plan', 400)
    const photo = form.get('before')
    if (!(photo instanceof File) || !photo.size || form.getAll('before').length !== 1) return fail('before_required', 400)
    const bytes = Buffer.from(await photo.arrayBuffer())
    if (!sniffImage(bytes)) return fail('invalid_image', 415)
    let before: Buffer
    try {
      // Normalize pixels and strip EXIF/location metadata before public sharing.
      before = await sharp(bytes, {limitInputPixels: 40_000_000}).rotate().resize({width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true}).jpeg({quality: 88}).toBuffer()
    } catch { return fail('invalid_image', 415) }
    const result = await publishDesign({id, ownerId: user.id, meta, before, pool: db(), store: storage()})
    return Response.json({...result, feedUrl: `/feed#design-${id}`}, {status: result.created ? 201 : 200, headers})
  } catch (error) {
    if (error instanceof PublishError) return fail(error.code, error.status)
    console.error('design publish failed', error instanceof Error ? error.name : 'unknown')
    return fail('publish_unavailable', 503)
  }
}
