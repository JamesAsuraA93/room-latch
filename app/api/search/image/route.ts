// POST /api/search/image — "find this product": our DB first, then Shopee; close matches are stored in the DB.
// multipart: image (required), category?, style?  ·  same-origin only, needs OPENAI_API_KEY on the server.
import {sameOriginRefusal} from '@/lib/live-render-core'
import {FormRefusal, imageDataUrl, readCappedForm} from '@/lib/form-image'
import {searchByImage} from '@/lib/image-search'
import {DecisionsError} from '@/lib/decisions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const headers = {'Cache-Control': 'no-store'}
const err = (status: number, code: string) => Response.json({error: {code}}, {status, headers})

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return err(404, 'image_search_disabled')
  const refused = sameOriginRefusal(req.headers, 'POST')
  if (refused) return err(403, refused)
  try {
    const form = await readCappedForm(req)
    const image = await imageDataUrl(form, 'image')
    const result = await searchByImage(image, {category: String(form.get('category') ?? '') || undefined, style: String(form.get('style') ?? '') || undefined})
    return Response.json(result, {headers})
  } catch (e) {
    if (e instanceof FormRefusal) return err(e.status, e.code)
    if (e instanceof DecisionsError) { console.error('image search: decisions failed', e.code, e.status); return err(502, 'decisions_failed') }
    console.error('image search failed', (e as Error).message)
    return err(500, 'image_search_failed')
  }
}
