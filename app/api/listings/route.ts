// GET /api/listings?style=japandi — real Shopee listings for a style, read from Neon Postgres.
import {NextResponse} from 'next/server'
import {listingsForStyle} from '@/lib/db'
import {isStyleId} from '@/lib/styles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const style = new URL(req.url).searchParams.get('style') ?? ''
  if (!isStyleId(style)) return NextResponse.json({error: 'unknown style'}, {status: 400})
  try {
    const listings = await listingsForStyle(style)
    return NextResponse.json({style, count: listings.length, listings})
  } catch (e) {
    console.error('listings query failed', (e as Error).message)
    return NextResponse.json({error: 'database unavailable'}, {status: 503})
  }
}
