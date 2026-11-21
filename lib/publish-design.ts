import type {Pool} from 'pg'
import {isRoomTypeId, isStyleId} from './styles.ts'

export const PUBLISH_MAX_BYTES = 4 * 1024 * 1024
export const isDesignId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
export type PublishMeta = {style: string; roomType: string; budget: number; itemIds: string[]}
export function parsePublishMeta(value: unknown): PublishMeta | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (!isStyleId(v.style) || !isRoomTypeId(v.roomType) || !Number.isInteger(v.budget) || (v.budget as number) < 1 || (v.budget as number) > 1_000_000) return null
  if (!Array.isArray(v.itemIds) || v.itemIds.length > 6 || v.itemIds.length < 1 || new Set(v.itemIds).size !== v.itemIds.length) return null
  if (v.itemIds.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(id))) return null
  return {style: v.style, roomType: v.roomType, budget: v.budget as number, itemIds: v.itemIds}
}

export class PublishError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, status = 400) { super(code); this.code = code; this.status = status }
}

type Store = {
  upload(key: string, bytes: Uint8Array, options: {contentType: string}): Promise<unknown>
  download(key: string): Promise<{bytes(): Promise<Uint8Array>}>
  delete(key: string): Promise<unknown>
}

/** A render UUID is the existing private job capability. Authentication identifies the publisher.
 * Copy both images to permanent design paths: render jobs are purged after 24 hours.
 * Same-job requests serialize, so retries and double clicks never create duplicate posts.
 */
export async function publishDesign({id, ownerId, meta, before, pool, store}: {
  id: string; ownerId: string; meta: PublishMeta; before: Uint8Array; pool: Pick<Pool, 'connect'>; store: Store
}): Promise<{id: string; created: boolean}> {
  if (!isDesignId(id)) throw new PublishError('invalid_design')
  const connection = await pool.connect()
  const uploaded: string[] = []
  let commitAttempted = false
  try {
    await connection.query('begin')
    await connection.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`publish:${id}`])
    const {rows: [existing]} = await connection.query('select owner_id, published_at from designs where id = $1', [id])
    if (existing) {
      if (existing.owner_id !== ownerId || !existing.published_at) throw new PublishError('design_unavailable', 403)
      commitAttempted = true; await connection.query('commit')
      return {id, created: false}
    }
    const {rows: [job]} = await connection.query('select status, output_path, image_w, image_h from render_jobs where id = $1 for share', [id])
    if (job?.status !== 'succeeded' || !job.output_path) throw new PublishError('render_not_ready', 409)
    // Resolve names, prices and foreign keys from the catalog, never from client-provided product details.
    const {rows: products} = await connection.query<{id: string; kind: 'listing' | 'catalog'; price: number}>(
      `select id, 'listing' as kind, price_thb::float8 as price from shopee_listings where id = any($1)
       union all select id, 'catalog' as kind, price_max_thb::float8 as price from catalog_items where id = any($1)`, [meta.itemIds])
    const byId = new Map(products.map(p => [p.id, p]))
    if (meta.itemIds.some(id => !byId.has(id))) throw new PublishError('unknown_product')
    const total = Math.ceil(meta.itemIds.reduce((sum, id) => sum + (byId.get(id)!.price || 0), 0))
    const beforePath = `designs/${id}/before.jpg`, afterPath = `designs/${id}/after.png`
    const after = await (await store.download(job.output_path)).bytes()
    // Track attempted writes as well: an interrupted upload may have reached storage.
    uploaded.push(beforePath)
    await store.upload(beforePath, before, {contentType: 'image/jpeg'})
    uploaded.push(afterPath)
    await store.upload(afterPath, after, {contentType: 'image/png'})
    await connection.query(
      `insert into designs (id, owner_id, room_type, style_id, budget_thb, total_max_thb, title,
         before_path, after_path, after_kind, image_w, image_h, consent_at, published_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ai_render',$10,$11,now(),now())`,
      [id, ownerId, meta.roomType, meta.style, meta.budget, total, 'ห้องของฉัน', beforePath, afterPath, job.image_w, job.image_h])
    for (const [position, productId] of meta.itemIds.entries()) {
      const product = byId.get(productId)!
      await connection.query('insert into design_items (design_id, position, listing_id, catalog_item_id) values ($1,$2,$3,$4)',
        [id, position, product.kind === 'listing' ? productId : null, product.kind === 'catalog' ? productId : null])
    }
    commitAttempted = true; await connection.query('commit')
    return {id, created: true}
  } catch (error) {
    // A connection loss during COMMIT is ambiguous. Keep image files rather than risk deleting a published post.
    // Clean up failures before releasing the lock, so a retry cannot race with deletion.
    if (!commitAttempted) await Promise.allSettled(uploaded.map(key => store.delete(key)))
    await connection.query('rollback').catch(() => {})
    throw error
  } finally { connection.release() }
}
