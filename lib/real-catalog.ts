// Static, vetted snapshot of real Shopee listings (catalog/shopee-real-snapshot.csv, 2026-11-21).
// Not a live API: no price, stock or rights claims, no image fetching. Kept separate from the
// budget/width engine (lib/plan.ts), which still uses catalog ranges + labelled fixtures.
import {isStyleId} from './styles.ts'

export const REAL_CATEGORIES = ['seating', 'table', 'light', 'textile', 'accent'] as const
export type RealCategory = typeof REAL_CATEGORIES[number]

/**
 * How much of the listing was checked. Only `photo` means a source listing photo was opened and matched.
 * - photo: listing + gallery/CDN photo opened
 * - listing: listing seen, photo not checked here (index only, or prior local photo not in this snapshot)
 * - gallery_failed: listing opened, gallery image could not be decoded
 */
export type Verification = 'photo' | 'listing' | 'gallery_failed'

export type RealProduct = {
  id: string // shopee-<shop>-<item>, allowlisted for the render prompt
  title: string
  category: RealCategory
  styles: string[] // app style ids; empty = no app style (still browsable under "all")
  url: string // exact listing page, never a search link
  verification: Verification
  dimensions: string | null // only what the snapshot states; never inferred
  notes: string
  price?: number | null // last observed listing price; not a live quote
  image?: string | null
}

// Editorial mapping from the snapshot's style tags to the app's 8 styles (owner-approved "alias + borrow").
// warm-modern and mid-century have no app style; rows with only those tags are left out.
export const STYLE_ALIAS: Record<string, string[]> = {
  japandi: ['japandi', 'muji'],
  minimal: ['minimal', 'muji'],
  scandinavian: ['scandi', 'nordic'],
  'natural-boho': ['boho'],
  industrial: ['loft'],
  'modern-classic': ['luxe'],
  'warm-modern': [],
  'mid-century': [],
}

// Files tagged with the app's own style ids (lib/styles.ts) are read with mode 'direct' (no aliasing),
// so 'minimal' there means only minimal, while the original snapshot keeps its aliases ('minimal' → minimal + muji).
type TagMode = 'alias' | 'direct'

const PHOTO = new Set(['Shopee exact listing to CDN', 'Shopee index + exact CDN + manufacturer model page', 'listing_and_gallery_opened'])

function verificationOf(status: string): Verification {
  if (PHOTO.has(status)) return 'photo'
  if (status === 'listing_opened_gallery_link_not_decoded') return 'gallery_failed'
  return 'listing'
}

export function toRealProducts(rows: Record<string, string>[], mode: TagMode = 'alias'): RealProduct[] {
  const seen = new Set<string>()
  const out: RealProduct[] = []
  for (const r of rows) {
    const shop = r.shop_id?.trim(), item = r.item_id?.trim()
    if (!/^\d+$/.test(shop ?? '') || !/^\d+$/.test(item ?? '')) continue
    const key = `${shop}/${item}`
    if (seen.has(key)) continue // dedup by shop/item
    seen.add(key)
    const category = r.category?.trim() as RealCategory
    if (!REAL_CATEGORIES.includes(category)) continue
    const tags = r.style_ids.split('|').map(s => s.trim())
    const styles = [...new Set(mode === 'direct' ? tags.filter(isStyleId) : tags.flatMap(s => STYLE_ALIAS[s] ?? []))]
    out.push({
      id: `shopee-${shop}-${item}`,
      title: r.title.trim(),
      category,
      styles,
      url: `https://shopee.co.th/product/${shop}/${item}`, // rebuilt from ids, not copied from the file
      verification: verificationOf(r.evidence_status.trim()),
      dimensions: r.dimensions_cm?.trim() || null,
      notes: r.notes?.trim() ?? '',
    })
  }
  return out
}

/** Merge files; the first occurrence of a shop/item wins (earlier, more-checked file first). */
export function mergeReal(...lists: RealProduct[][]): RealProduct[] {
  const seen = new Set<string>()
  return lists.flat().filter(p => !seen.has(p.id) && (seen.add(p.id), true))
}
