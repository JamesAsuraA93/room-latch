// GET /api/designs/<uuid>/before|after — redirects to a short-lived presigned URL in the private "assets" bucket.
// Only published designs; the key comes from the DB row, never from the request.
import {publishedImagePath} from '@/lib/db'
import {storage} from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export async function GET(_req: Request, {params}: {params: Promise<{id: string; side: string}>}) {
  const {id, side} = await params
  if (!UUID.test(id) || (side !== 'before' && side !== 'after')) return new Response(null, {status: 404})
  try {
    const key = await publishedImagePath(id, side)
    if (!key) return new Response(null, {status: 404})
    const url = await storage().url(key, {expiresIn: 600})
    return new Response(null, {status: 302, headers: {Location: url, 'Cache-Control': 'private, max-age=300', 'Referrer-Policy': 'no-referrer'}})
  } catch (e) {
    console.error('design image failed', (e as Error).message)
    return new Response(null, {status: 503})
  }
}
