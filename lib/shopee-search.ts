// Shopee TH public search: request + parsing in one place, shared by scripts/gather-shopee.mts and
// lib/image-search.ts. No Next imports so plain Node scripts/tests can load it.
// Shopee answers bots with errors or captchas now and then; callers skip that query, never work around it.

// Search words: a category word plus a style word ("product × style"), so Shopee's own ranking already leans to the style.
export const CATEGORY_SEARCH_WORDS: Record<string, string[]> = {
  seating: ['โซฟา', 'เก้าอี้'],
  table: ['โต๊ะกลาง', 'โต๊ะข้าง'],
  light: ['โคมไฟตั้งพื้น', 'โคมไฟ'],
  textile: ['พรม', 'ผ้าม่าน'],
  accent: ['แจกัน', 'ชั้นวางของ'],
}
export const STYLE_SEARCH_WORDS: Record<string, string> = {
  minimal: 'มินิมอล', muji: 'สไตล์มูจิ', japandi: 'เจแปนดิ', scandi: 'สแกนดิเนเวียน',
  loft: 'ลอฟท์', luxe: 'โมเดิร์น หรูหรา', boho: 'โบฮีเมียน', nordic: 'นอร์ดิก',
}
export const searchKeywords = (category: string, style?: string | null) =>
  (CATEGORY_SEARCH_WORDS[category] ?? []).map(w => (style && STYLE_SEARCH_WORDS[style] ? `${w} ${STYLE_SEARCH_WORDS[style]}` : w))

export type Candidate = {shop: number; item: number; title: string; image: string; price: number | null; rating: number | null; shopName: string | null; hints: Set<string>}

export const SHOPEE_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36'
/** Full-size listing photo on Shopee's CDN; `_tn` is the small thumbnail. */
export const shopeeImage = (hash: string, thumb = false) => `https://down-th.img.susercontent.com/file/${hash}${thumb ? '_tn' : ''}`
export const listingId = (c: {shop: number; item: number}) => `shopee-${c.shop}-${c.item}`

/** Shopee search JSON → candidates. Shopee prices are THB × 100000. */
export function parseSearch(json: any, hint: string): Candidate[] {
  if (!Array.isArray(json?.items)) throw new Error(`no items (error=${json?.error ?? 'none'})`)
  return json.items.flatMap((it: any) => {
    const b = it?.item_basic
    if (!b || !Number.isSafeInteger(b.itemid) || !Number.isSafeInteger(b.shopid) || !b.name || !/^[\w-]+$/.test(b.image ?? '')) return []
    const price = Number(b.price_min ?? b.price) / 100000
    const rating = Number(b.item_rating?.rating_star)
    return [{shop: b.shopid, item: b.itemid, title: String(b.name).trim().slice(0, 300), image: b.image,
      price: price > 0 ? price : null, rating: rating > 0 ? Math.round(rating * 100) / 100 : null,
      shopName: b.shop_name || null, hints: new Set([hint])}]
  })
}

export async function searchShopee(keyword: string, page = 0, limit = 60, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const q = new URLSearchParams({by: 'relevancy', keyword, limit: String(limit), newest: String(page * limit), order: 'desc', page_type: 'search'})
  const res = await fetchImpl(`https://shopee.co.th/api/v4/search/search_items?${q}`, {headers: {'user-agent': SHOPEE_UA, accept: 'application/json'}})
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
