// POST /api/neon/health — local smoke test of both Neon services. Loopback only (403 on Vercel or any
// other host); same-origin POST only. Writes one tiny object under health/ and deletes it again.
import {randomUUID} from 'node:crypto'
import {NextResponse} from 'next/server'
import {db} from '@/lib/db'
import {storage} from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$/i

export async function POST(req: Request) {
  const host = req.headers.get('host') ?? ''
  if (process.env.VERCEL || !LOOPBACK.test(host) || req.headers.get('origin') !== `http://${host}`) return new Response(null, {status: 403})

  const result: Record<string, unknown> = {}
  try {
    const t = Date.now()
    const {rows} = await db().query(`select current_setting('server_version') as version,
      (select count(*)::int from styles) as styles, (select count(*)::int from catalog_items) as catalog_items,
      (select count(*)::int from shopee_listings) as listings, (select count(*)::int from designs) as designs`)
    result.postgres = {ok: true, ms: Date.now() - t, ...rows[0]}
  } catch (e) { result.postgres = {ok: false, error: (e as Error).message} }

  const key = `health/${randomUUID()}.txt`
  const body = `roomlatch health ${new Date().toISOString()}`
  try {
    const t = Date.now(), files = storage()
    await files.upload(key, body, {contentType: 'text/plain'})
    const existed = await files.exists(key)
    const roundTrip = (await (await files.download(key)).text()) === body
    const signed = await files.url(key, {expiresIn: 60})
    const viaSignedUrl = (await (await fetch(signed)).text()) === body
    await files.delete(key)
    const goneAfterDelete = !(await files.exists(key))
    result.storage = {ok: existed && roundTrip && viaSignedUrl && goneAfterDelete, ms: Date.now() - t, key, existed, roundTrip, viaSignedUrl, goneAfterDelete}
  } catch (e) {
    result.storage = {ok: false, key, error: (e as Error).message}
    await storage().delete(key).catch(() => {})
  }
  const ok = (result.postgres as {ok: boolean}).ok && (result.storage as {ok: boolean}).ok
  return NextResponse.json({ok, ...result}, {status: ok ? 200 : 500})
}
