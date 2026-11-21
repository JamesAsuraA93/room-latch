import 'server-only'
// Server only. Two Decisions-backed searches:
//  - rankForRoom: order shop listings by how well they fit the user's room photo in the chosen style
//  - searchByImage: "find this product": our DB first; if nothing looks close enough, search Shopee,
//    keep the close matches and store them in the DB so the next search finds them there.
// Listing photos reach the model as short-lived presigned URLs (private bucket) or Shopee CDN links, never via the client.
import {classifyRequest, decideAll, decide, decisionsUsd, fitRequest, matchRequest, parseClassify, parseFit, parseMatch, MAX_SCORE, type Fit, type Match} from '@/lib/decisions'
import {imageListingsByCategory, listingsWithImages, upsertFoundListings, type FoundListing, type ImageListing} from '@/lib/db'
import {listingId, parseSearch, searchKeywords, searchShopee, shopeeImage, type Candidate} from '@/lib/shopee-search'
import {REAL_CATEGORIES} from '@/lib/real-catalog'
import {STYLE_IDS, isStyleId} from '@/lib/styles'
import {storage} from '@/lib/storage'

export const MAX_RANK_IDS = 40
const DB_CANDIDATES = 40
const SHOPEE_PER_KEYWORD = 30
const SHOPEE_CANDIDATES = 40
const PRESIGN_SECONDS = 600
// Match score is isProduct x likeness on the 0..3 scale (see LOOKS_LIKE in lib/decisions.ts)
const DB_HIT = 2.0        // "similar" or better in our DB: no need to search Shopee
const KEEP = 1.5          // worth storing / showing: between "same category" and "similar"
const MAX_RESULTS = 8

async function imageUrlOf(l: ImageListing): Promise<string | null> {
  if (l.image_path) return storage().url(l.image_path, {expiresIn: PRESIGN_SECONDS})
  return l.image_url
}

async function withImageUrls(rows: ImageListing[]) {
  const refs = await Promise.all(rows.map(async l => ({...l, imageUrl: await imageUrlOf(l)})))
  return refs.filter((r): r is ImageListing & {imageUrl: string} => !!r.imageUrl)
}

export type RankResult = {fits: Fit[]; unranked: string[]; usd: number}

export async function rankForRoom(roomImage: string, style: {th: string; prompt: string}, ids: string[]): Promise<RankResult> {
  const rows = await withImageUrls(await listingsWithImages(ids.slice(0, MAX_RANK_IDS)))
  const {rows: fits, inputTokens} = await decideAll(rows, b => fitRequest(roomImage, style, b), parseFit)
  fits.sort((a, b) => b.score - a.score)
  const ranked = new Set(fits.map(f => f.id))
  return {fits, unranked: ids.filter(id => !ranked.has(id)), usd: decisionsUsd(inputTokens)}
}

export type ImageHit = {id: string; title: string; url: string; category: string; price: number | null; score: number; source: 'db' | 'shopee'}
export type ImageSearchResult = {category: string; style: string | null; source: 'db' | 'shopee' | 'none'; hits: ImageHit[]; added: string[]; usd: number}

const keepTop = <T extends {score: number}>(xs: T[], min: number) => xs.filter(x => x.score >= min).sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS)

async function shopeeCandidates(category: string, style: string | null, skip: Set<string>): Promise<Candidate[]> {
  const found = new Map<string, Candidate>()
  for (const keyword of searchKeywords(category, style)) {
    try {
      for (const c of parseSearch(await searchShopee(keyword, 0, SHOPEE_PER_KEYWORD), `${style ?? 'any'}/${category}`)) {
        if (!skip.has(listingId(c)) && !found.has(listingId(c))) found.set(listingId(c), c)
      }
    } catch (e) {
      // Shopee blocks server-side requests now and then: skip this keyword, keep the rest
      console.warn(`shopee search "${keyword}" skipped: ${(e as Error).message}`)
    }
    if (found.size >= SHOPEE_CANDIDATES) break
  }
  return [...found.values()].slice(0, SHOPEE_CANDIDATES)
}

export async function searchByImage(image: string, hint: {category?: string; style?: string} = {}): Promise<ImageSearchResult> {
  let tokens = 0
  let category = hint.category && (REAL_CATEGORIES as readonly string[]).includes(hint.category) ? hint.category : null
  let style = hint.style && isStyleId(hint.style) ? hint.style : null
  if (!category || !style) {
    const payload = await decide(classifyRequest(image, REAL_CATEGORIES, STYLE_IDS))
    tokens += payload.usage?.input_tokens ?? 0
    const c = parseClassify(payload)
    category ??= c.category && (REAL_CATEGORIES as readonly string[]).includes(c.category) ? c.category : null
    style ??= c.style && isStyleId(c.style) ? c.style : null
  }
  if (!category) return {category: '', style, source: 'none', hits: [], added: [], usd: decisionsUsd(tokens)}

  // 1. our own catalog
  const dbRows = await withImageUrls(await imageListingsByCategory(category, DB_CANDIDATES))
  const dbMatch = await decideAll(dbRows, b => matchRequest(image, category!, b), parseMatch)
  tokens += dbMatch.inputTokens
  const byId = new Map(dbRows.map(r => [r.id, r]))
  const dbHits: ImageHit[] = keepTop(dbMatch.rows, KEEP).map((m: Match) => {
    const r = byId.get(m.id)!
    return {id: r.id, title: r.title, url: r.url, category, price: r.price_thb ? Number(r.price_thb) : null, score: m.score, source: 'db'}
  })
  if (dbHits[0] && dbHits[0].score >= DB_HIT) return {category, style, source: 'db', hits: dbHits, added: [], usd: decisionsUsd(tokens)}

  // 2. Shopee, then store what matched so the next search finds it in our DB
  const fresh = await shopeeCandidates(category, style, new Set(dbRows.map(r => r.id)))
  const refs = fresh.map(c => ({id: listingId(c), imageUrl: shopeeImage(c.image, true), c}))
  const shopMatch = await decideAll(refs, b => matchRequest(image, category!, b), parseMatch)
  tokens += shopMatch.inputTokens
  const kept = keepTop(shopMatch.rows, KEEP)
  const cands = new Map(refs.map(r => [r.id, r.c]))
  const found: FoundListing[] = kept.map(m => {
    const c = cands.get(m.id)!
    return {id: m.id, shop: c.shop, item: c.item, title: c.title, category: category!, imageUrl: shopeeImage(c.image),
      price: c.price, shopName: c.shopName, rating: c.rating, styles: style ? [style] : []}
  })
  const added = await upsertFoundListings(found)
  const shopHits: ImageHit[] = kept.map(m => {
    const c = cands.get(m.id)!
    return {id: m.id, title: c.title, url: `https://shopee.co.th/product/${c.shop}/${c.item}`, category, price: c.price, score: m.score, source: 'shopee'}
  })
  const hits = [...dbHits, ...shopHits].sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS)
  return {category, style, source: hits.length ? (shopHits.length ? 'shopee' : 'db') : 'none', hits, added, usd: decisionsUsd(tokens)}
}

export {MAX_SCORE}
