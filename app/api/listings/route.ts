// GET /api/listings?style=japandi — real Shopee listings for a style, read from Neon Postgres.
import {NextResponse} from 'next/server'
import {listingsForStyle} from '@/lib/db'
import {APP_STYLES} from '@/lib/real-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const style = new URL(req.url).searchParams.get('style') ?? ''
  if (!APP_STYLES.includes(style)) return NextResponse.json({error: 'unknown style'}, {status: 400})
  try {
    const listings = await listingsForStyle(style)
    return NextResponse.json({style, count: listings.length, listings})
  } catch (e) {
    console.error('listings query failed', (e as Error).message)
    return NextResponse.json({error: 'database unavailable'}, {status: 503})
  }
}
