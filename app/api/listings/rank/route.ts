// POST /api/listings/rank — order listings by how well they fit the user's room photo in a style (Decisions API).
// multipart: image (the room photo), style (app style id), ids (JSON array of listing ids, ≤ MAX_RANK_IDS)
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {sameOriginRefusal} from '@/lib/live-render-core'
import {FormRefusal, imageDataUrl, readCappedForm} from '@/lib/form-image'
import {MAX_RANK_IDS, rankForRoom} from '@/lib/image-search'
import {DecisionsError} from '@/lib/decisions'
import {isStyleId} from '@/lib/styles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const headers = {'Cache-Control': 'no-store'}
const err = (status: number, code: string) => Response.json({error: {code}}, {status, headers})
const ID = /^shopee-\d+-\d+$/

function styleText(key: string): {th: string; prompt: string} | null {
  const reg = JSON.parse(readFileSync(path.join(process.cwd(), 'prompts', 'registry.json'), 'utf8')) as {styles: {key: string; th: string; prompt: string}[]}
  return reg.styles.find(s => s.key === key) ?? null
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return err(404, 'rank_disabled')
  const refused = sameOriginRefusal(req.headers, 'POST')
  if (refused) return err(403, refused)
  try {
    const form = await readCappedForm(req)
    const style = String(form.get('style') ?? '')
    if (!isStyleId(style)) return err(400, 'unsupported_style')
    let ids: unknown
    try { ids = JSON.parse(String(form.get('ids') ?? '[]')) } catch { return err(400, 'bad_ids') }
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_RANK_IDS || !ids.every(i => typeof i === 'string' && ID.test(i))) return err(400, 'bad_ids')
    const room = await imageDataUrl(form, 'image')
    return Response.json(await rankForRoom(room, styleText(style)!, ids as string[]), {headers})
  } catch (e) {
    if (e instanceof FormRefusal) return err(e.status, e.code)
    if (e instanceof DecisionsError) { console.error('rank: decisions failed', e.code, e.status); return err(502, 'decisions_failed') }
    console.error('rank failed', (e as Error).message)
    return err(500, 'rank_failed')
  }
}
