// LOCAL ONLY: serves the owner's private Before / AI After from RoomAI/samples/private-example (Git-ignored).
// Fixed file names only; 404 unless ROOMLATCH_LOCAL_DEMO=1, not on Vercel, and requested via loopback.
import {readFile} from 'node:fs/promises'
import {privateExampleFile} from '@/lib/local-demo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$/i

export async function GET(req: Request, {params}: {params: Promise<{name: string}>}) {
  const site = req.headers.get('sec-fetch-site')
  if (!LOOPBACK.test(req.headers.get('host') ?? '') || (site && site !== 'same-origin' && site !== 'none')) return new Response(null, {status: 403})
  const file = privateExampleFile((await params).name)
  if (!file) return new Response(null, {status: 404})
  try {
    return new Response(new Uint8Array(await readFile(file.path)), {headers: {'Content-Type': file.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}})
  } catch { return new Response(null, {status: 404}) }
}
