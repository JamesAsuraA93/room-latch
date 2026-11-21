// Mock render API. Only POST is exported, so Next answers other methods with 405.
// Never logs request bodies and never touches process.env: the mock needs no key.
import {MAX_BODY_BYTES, mockRender, parseRenderBody, type RenderError} from '@/lib/render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = {'Cache-Control': 'no-store'}
const error = ({status, code, message}: RenderError) => Response.json({error: {code, message}}, {status, headers})

export async function POST(req: Request) {
  const type = req.headers.get('content-type') ?? ''
  if (!/^application\/json(\s*;|$)/i.test(type)) return error({status: 415, code: 'unsupported_media_type', message: 'Content-Type must be application/json.'})
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return error({status: 413, code: 'body_too_large', message: `Body must be ≤ ${MAX_BODY_BYTES} bytes.`})
  // shortcut: chunked bodies without content-length are read fully before the size check; fine for a mock behind the platform's own body cap.
  const parsed = parseRenderBody(await req.text())
  if (!parsed.ok) return error(parsed.error)
  return Response.json(mockRender(parsed.input), {headers})
}
