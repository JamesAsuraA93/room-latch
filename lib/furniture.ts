import type {Product} from './plan.ts'
import type {RealProduct} from './real-catalog.ts'

export const FURNITURE_CATEGORIES = {
  chair: 'เก้าอี้', sofa: 'โซฟา', table: 'โต๊ะ', light: 'โคมไฟ', rug: 'ผ้าและพรม', storage: 'ที่เก็บของ', decor: 'ของตกแต่ง',
} as const
export type FurnitureCategory = keyof typeof FURNITURE_CATEGORIES
export type Furniture = {
  id: string; name: string; category: FurnitureCategory; styles: string[]
  price: number | null; priceKind: 'listed' | 'estimate' | 'unknown'
  image: string | null; url: string; roomType?: string
}
export const MAX_FURNITURE = 6

export function furnitureCategory(name: string, category: string): FurnitureCategory {
  // Trust the catalog category before title keywords (a "table lamp" is not a table).
  if (['light', 'lighting'].includes(category)) return 'light'
  if (category === 'textile') return 'rug'
  if (category === 'table') return 'table'
  if (category === 'accent') return /ตู้|ชั้นวาง|กล่อง|ตะกร้า|ราวแขวน/i.test(name) ? 'storage' : 'decor'
  if (category === 'seating') return /โซฟา|sofa|บีนแบ็ก|bean.?bag/i.test(name) ? 'sofa' : 'chair'
  if (/โคม|lamp/i.test(name)) return 'light'
  if (/พรม|ผ้าม่าน|ผ้าปู|ผ้านวม|หมอน|เบาะรอง/i.test(name)) return 'rug'
  if (/โซฟา|sofa|บีนแบ็ก|bean.?bag/i.test(name)) return 'sofa'
  if (/เก้าอี้|สตูล|ม้านั่ง|เบาะรองนั่ง|chair|stool/i.test(name) || ['chair', 'seating'].includes(category)) return 'chair'
  if (/โต๊ะ|table|desk/i.test(name) || category === 'table') return 'table'
  if (/โคม|ไฟ|lamp/i.test(name) || ['light', 'lighting'].includes(category)) return 'light'
  if (/ตู้|ชั้นวาง|กล่อง|ตะกร้า|ราวแขวน/i.test(name)) return 'storage'
  if (/พรม|ผ้า|หมอน|ม่าน/i.test(name) || category === 'textile') return 'rug'
  return 'decor'
}

export function furnitureCatalog(real: RealProduct[], estimates: Product[]): Furniture[] {
  return [
    ...real.map(p => {
      // A ฿1 placeholder/promotion is not a usable furniture budget quote.
      const price = typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 1 ? p.price : null
      return {id: p.id, name: p.title, category: furnitureCategory(p.title, p.category), styles: p.styles,
        price, priceKind: price === null ? 'unknown' as const : 'listed' as const, image: p.image || null, url: p.url}
    }),
    ...estimates.map(p => ({id: p.id, name: p.name.replace(' (fixture)', ''), category: furnitureCategory(p.name, p.slot), styles: p.styles,
      price: p.priceMax, priceKind: 'estimate' as const, image: null, roomType: p.roomType,
      url: p.deeplink || `https://shopee.co.th/search?keyword=${encodeURIComponent(p.keyword)}`})),
  ]
}

export const selectionContext = (p: {style: string; roomType: string; budget: number; need?: string; areaM2?: number | null}) => JSON.stringify({style: p.style, roomType: p.roomType, budget: p.budget, need: p.need?.trim() || '', areaM2: p.areaM2 ?? null})
export const furnitureTotal = (items: Furniture[]) => ({
  total: items.reduce((sum, item) => sum + (item.price ?? 0), 0),
  unknown: items.filter(item => item.price === null).length,
  estimated: items.some(item => item.priceKind === 'estimate'),
})

/** Prefer priced listings in the chosen style, with one item per furniture category. */
export function recommendFurniture(all: Furniture[], plan: {style: string; roomType: string; budget: number}): Furniture[] {
  const groups: FurnitureCategory[][] = plan.roomType === 'living'
    ? [['sofa', 'chair'], ['table'], ['light'], ['rug', 'decor']]
    : plan.roomType === 'bedroom' ? [['storage', 'table'], ['light'], ['rug'], ['chair', 'decor']]
    : [['chair', 'sofa'], ['table'], ['light'], ['decor', 'storage']]
  const items: Furniture[] = []
  let remaining = plan.budget
  for (const [index, categories] of groups.entries()) {
    const candidates = all.filter(p => p.styles.includes(plan.style) && categories.includes(p.category)
      && p.price !== null && p.price <= remaining && !items.some(i => i.id === p.id || i.category === p.category))
    const allowance = remaining / (groups.length - index)
    candidates.sort((a, b) => {
      const rank = (p: Furniture) => (p.priceKind === 'listed' ? 100 : 0) + (p.image ? 10 : 0)
        + (p.price! <= allowance ? 20 : 0) + (p.roomType === plan.roomType ? 5 : 0) + (p.category === categories[0] ? 5 : 0)
      return rank(b) - rank(a) || Math.abs(a.price! - allowance) - Math.abs(b.price! - allowance) || a.id.localeCompare(b.id)
    })
    if (candidates[0]) { items.push(candidates[0]); remaining -= candidates[0].price! }
  }
  return items
}

/** Replace exactly one item, including cross-category swaps; never change other choices. */
export function replaceFurniture(items: Furniture[], targetId: string, replacement: Furniture): Furniture[] {
  if (!items.some(p => p.id === targetId) || items.some(p => p.id === replacement.id && p.id !== targetId)) return items
  return items.map(p => p.id === targetId ? replacement : p)
}

export function validateFurnitureIds(ids: string[], known: Map<string, string>): boolean {
  return ids.length > 0 && ids.length <= MAX_FURNITURE && new Set(ids).size === ids.length && ids.every(id => known.has(id))
}
