// Server only. Neon Postgres via node-postgres on the pooled DATABASE_URL (pulled by `neon deploy`).
// attachDatabasePool lets Vercel Fluid compute close idle clients before the instance suspends.
// Schema/seed live in ../db/*.sql and are applied with DATABASE_URL_UNPOOLED, not from the app.
import {Pool} from 'pg'
import {attachDatabasePool} from '@vercel/functions'

const g = globalThis as unknown as {__rlPool?: Pool}

export function db(): Pool {
  if (!g.__rlPool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL is not set')
    g.__rlPool = new Pool({connectionString, max: 5})
    attachDatabasePool(g.__rlPool)
  }
  return g.__rlPool
}

export type DbListing = {id: string; title: string; category: string; url: string; verification: string; dimensions_cm: string | null}

/** Real Shopee listings for one app style (no price/stock: the table has none). */
export async function listingsForStyle(style: string): Promise<DbListing[]> {
  const {rows} = await db().query<DbListing>(
    `select l.id, l.title, l.category, l.url, l.verification, l.dimensions_cm
       from shopee_listings l join shopee_listing_styles s on s.listing_id = l.id
      where s.style_id = $1
      order by l.category, l.title
      limit 100`,
    [style],
  )
  return rows
}
