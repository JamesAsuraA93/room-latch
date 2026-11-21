// POST /api/recommend — step 5: real Shopee products for the room within the budget (lib/recommend.ts).
// Same-origin only. Never logs the user's text. Model calls are capped per day (lib/render-jobs.ts recommendLimits);
// over a cap the answer is the free rules pick.
import {clientKey, sameOriginRefusal} from '@/lib/live-render-core'
import {t} from '@/lib/copy'
import {isRoomTypeId, isStyleId} from '@/lib/styles'
import {listingUrl, MAX_NEED_CHARS} from '@/lib/recommend-core'
import {recommend} from '@/lib/recommend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 150

const MAX_BODY_BYTES = 4 * 1024
const headers = {'Cache-Control': 'no-store'}
const err = (status: number, code: string) => Response.json({error: {code}}, {status, headers})
const intIn = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi

export async function POST(req: Request) {
  const refused = sameOriginRefusal(req.headers, 'POST')
  if (refused) return err(403, refused)
  if (!/^application\/json(\s*;|$)/i.test(req.headers.get('content-type') ?? '')) return err(415, 'unsupported_media_type')
  const text = await req.text()
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return err(413, 'body_too_large')
  let body: Record<string, unknown>
  try { body = JSON.parse(text) } catch { return err(400, 'bad_json') }
  const {styleId, roomType, budget, width, need = ''} = body ?? {}
  if (!isStyleId(styleId)) return err(400, 'unsupported_style')
  if (!isRoomTypeId(roomType)) return err(400, 'invalid_room_type')
  if (!intIn(budget, 1, 1_000_000) || !intIn(width, 1, 1000)) return err(400, 'invalid_number')
  if (typeof need !== 'string' || need.length > MAX_NEED_CHARS) return err(400, 'invalid_need')

  try {
    const labels = t as Record<string, string>
    const result = await recommend({
      style: styleId, styleTh: labels[styleId] ?? styleId, roomType, roomTh: labels[roomType] ?? roomType,
      budget: budget as number, widthCm: width as number, need: need.replace(/[\x00-\x1f]/g, ' ').trim(),
    }, clientKey(req.headers))
    return Response.json({...result, items: result.items.map(p => ({...p, url: listingUrl(p.id)}))}, {headers})
  } catch (e) {
    console.error('recommend failed', (e as Error).message)
    return err(503, 'recommend_unavailable')
  }
}
