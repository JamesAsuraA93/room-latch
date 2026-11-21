// GET /api/feed — published designs from Neon Postgres, as Feed posts. Images go through /api/designs/[id]/[side].
import {NextResponse} from 'next/server'
import {publishedDesigns} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const posts = (await publishedDesigns()).map(p => ({
      ...p, budget: p.budget ?? undefined, width: p.width ?? undefined, example: true,
      before: `/api/designs/${p.id}/before`, after: `/api/designs/${p.id}/after`,
    }))
    return NextResponse.json({posts}, {headers: {'Cache-Control': 'no-store'}})
  } catch (e) {
    console.error('feed query failed', (e as Error).message)
    return NextResponse.json({error: 'feed unavailable'}, {status: 503})
  }
}
