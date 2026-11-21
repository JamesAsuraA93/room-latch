// Server only. Neon Postgres via node-postgres on the pooled DATABASE_URL (pulled by `neon deploy`).
// attachDatabasePool lets Vercel Fluid compute close idle clients before the instance suspends.
// Schema/seed live in db/*.sql and are applied with DATABASE_URL_UNPOOLED, not from the app.
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

export type DbFeedPost = {
  id: string; user: string; roomLabel: string; style: string; roomType: string
  budget: number | null; width: number | null; imageW: number; imageH: number
  items: {name: string; url: string}[]
}

/** Published designs (Feed posts), newest first. Images are served by /api/designs/[id]/[side]. */
export async function publishedDesigns(limit = 20): Promise<DbFeedPost[]> {
  const {rows} = await db().query<DbFeedPost>(
    `select d.id, p.display_name as "user", coalesce(d.title, '') as "roomLabel", d.style_id as style, d.room_type as "roomType",
            d.budget_thb as budget, d.width_cm as width, d.image_w as "imageW", d.image_h as "imageH",
            coalesce((select json_agg(json_build_object('name', coalesce(l.title, c.name), 'url', coalesce(l.url, c.listing_url)) order by i.position)
                        from design_items i
                        left join shopee_listings l on l.id = i.listing_id
                        left join catalog_items c on c.id = i.catalog_item_id
                       where i.design_id = d.id), '[]') as items
       from designs d join profiles p on p.user_id = d.owner_id
      where d.published_at is not null
      order by d.published_at desc
      limit $1`,
    [limit],
  )
  return rows
}

/** Storage key of a published design image, or null (unpublished, unknown or missing). */
export async function publishedImagePath(id: string, side: 'before' | 'after'): Promise<string | null> {
  const {rows} = await db().query<{path: string | null}>(
    `select ${side === 'before' ? 'before_path' : 'after_path'} as path from designs where id = $1 and published_at is not null`, [id])
  return rows[0]?.path ?? null
}
