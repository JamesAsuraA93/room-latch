// Server only. Neon Postgres via node-postgres on the pooled DATABASE_URL (pulled by `neon deploy`).
// attachDatabasePool lets Vercel Fluid compute close idle clients before the instance suspends.
// Schema/seed live in db/*.sql and are applied with DATABASE_URL_UNPOOLED, not from the app.
import {Pool} from 'pg'
import {attachDatabasePool} from '@vercel/functions'
import type {RealProduct} from '@/lib/real-catalog'
import type {Candidate} from '@/lib/recommend-core'

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
    // 20 per category so 100 rows cover all five; hand-checked rows first, then best-rated search finds.
    `select id, title, category, url, verification, dimensions_cm from (
       select l.*, row_number() over (partition by l.category order by (l.source = 'search'), l.rating desc nulls last, l.title) as k
         from shopee_listings l join shopee_listing_styles s on s.listing_id = l.id
        where s.style_id = $1) t
      where k <= 20
      order by category, k`,
    [style],
  )
  return rows
}

/** Result page catalog: per style, the same top 20 per category as listingsForStyle, with every style tag. */
export async function realListings(): Promise<RealProduct[]> {
  const {rows} = await db().query<RealProduct>(
    `with ranked as (
       select l.id, row_number() over (partition by s.style_id, l.category order by (l.source = 'search'), l.rating desc nulls last, l.title) as k
         from shopee_listings l join shopee_listing_styles s on s.listing_id = l.id)
     select l.id, l.title, l.category, l.url, l.verification, l.dimensions_cm as dimensions, l.notes,
            l.price_thb::float8 as price,
            case when coalesce(nullif(trim(l.image_path), ''), nullif(trim(l.image_url), '')) is not null
                 then '/api/listings/' || l.id || '/image' else null end as image,
            (select array_agg(style_id order by style_id) from shopee_listing_styles where listing_id = l.id) as styles
       from shopee_listings l
      where l.id in (select id from ranked where k <= 20)
      order by l.category, l.title`)
  return rows
}

/** Titles for listing ids (render allowlist); unknown ids are simply absent. */
export async function listingTitles(ids: string[]): Promise<[string, string][]> {
  if (!ids.length) return []
  const {rows} = await db().query<{id: string; title: string}>('select id, title from shopee_listings where id = any($1)', [ids])
  return rows.map(r => [r.id, r.title])
}

export type ListingAsset = {id: string; title: string; dimensions: string | null; imagePath: string | null; imageUrl: string | null}

/** What the render pipeline needs per listing: our private photo copy (or the CDN link), the title and any verified size. */
export async function listingAssets(ids: string[]): Promise<ListingAsset[]> {
  if (!ids.length) return []
  const {rows} = await db().query<ListingAsset>(
    `select id, title, dimensions_cm as dimensions, image_path as "imagePath", image_url as "imageUrl" from shopee_listings where id = any($1)`, [ids])
  return rows
}

/** Step 5 candidates: priced listings of a style that we can also render (photo in the bucket or on the CDN),
 *  the best rated per category among those that fit the budget on their own. */
export async function recommendCandidates(style: string, budget: number, perCategory = 30): Promise<Candidate[]> {
  const {rows} = await db().query<Candidate>(
    `select id, title, category, price, rating, image from (
       select l.id, l.title, l.category, l.price_thb::float8 as price, l.rating, l.image_url as image,
              row_number() over (partition by l.category order by l.rating desc nulls last, l.price_thb) as k
         from shopee_listings l join shopee_listing_styles s on s.listing_id = l.id
        where s.style_id = $1 and l.price_thb between 20 and $2
          and coalesce(nullif(trim(l.image_path), ''), nullif(trim(l.image_url), '')) is not null) t
      where k <= $3
      order by category, k`,
    [style, budget, perCategory],
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

export type AdminOverview = {
  totals: {listings: number; search: number; curated: number; users: number; designs: number; published: number; likes: number; saves: number}
  grid: {style: string; category: string; n: number}[]
  recentListings: {id: string; title: string; category: string; url: string; price_thb: string | null; rating: number | null; shop_name: string | null; checked_on: string}[]
  users: {user_id: string; handle: string; display_name: string; email: string | null; created_at: string; designs: number; published: number}[]
  recentDesigns: {id: string; handle: string; style_id: string; room_type: string; title: string | null; created_at: string; published_at: string | null}[]
}

/** Everything /admin shows, in one round trip per section. Admin-only: caller must gate. */
export async function adminOverview(): Promise<AdminOverview> {
  const q = async <T,>(sql: string) => (await db().query(sql)).rows as T[]
  const [[totals], grid, recentListings, users, recentDesigns] = await Promise.all([
    q<AdminOverview['totals']>(`select
       (select count(*)::int from shopee_listings) listings,
       (select count(*)::int from shopee_listings where source = 'search') search,
       (select count(*)::int from shopee_listings where source <> 'search') curated,
       (select count(*)::int from profiles) users,
       (select count(*)::int from designs) designs,
       (select count(*)::int from designs where published_at is not null) published,
       (select count(*)::int from design_likes) likes,
       (select count(*)::int from design_saves) saves`),
    q<AdminOverview['grid'][number]>(`select s.style_id style, l.category, count(*)::int n
       from shopee_listings l join shopee_listing_styles s on s.listing_id = l.id group by 1, 2`),
    q<AdminOverview['recentListings'][number]>(`select id, title, category, url, price_thb, rating, shop_name, checked_on::text
       from shopee_listings order by checked_on desc, rating desc nulls last limit 50`),
    q<AdminOverview['users'][number]>(`select p.user_id, p.handle, p.display_name, u.email, p.created_at::text,
       count(d.id)::int designs, count(d.published_at)::int published
       from profiles p left join "user" u on u.id = p.user_id left join designs d on d.owner_id = p.user_id
       group by p.user_id, u.email order by p.created_at desc limit 200`),
    q<AdminOverview['recentDesigns'][number]>(`select d.id, p.handle, d.style_id, d.room_type, d.title, d.created_at::text, d.published_at::text
       from designs d join profiles p on p.user_id = d.owner_id order by d.created_at desc limit 50`),
  ])
  return {totals, grid, recentListings, users, recentDesigns}
}
