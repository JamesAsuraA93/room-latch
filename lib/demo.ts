import {t} from '@/lib/copy'
import {EXAMPLE_POSTS} from '@/lib/feed-examples'
import type {Product} from '@/lib/plan'
import type {Furniture} from './furniture.ts'
import type {Job} from './live-render-core.ts'
import {FLOOR_PLAN_KEY, FURNITURE_SELECTION_KEY, DRAFTS_KEY, PLACEMENT_KEY, PLAN_KEY, PRODUCT_RENDER_KEY, RENDER_KEY, ROOM_IMAGE_KEY, ROOM_IMAGES_KEY, SOCIAL_KEY, STYLE_REFERENCE_KEY} from '@/lib/storage-keys'
import {ROOM_TYPE_IDS, STYLE_IDS, type StyleId} from '@/lib/styles'

const u = (id: string, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`

export const BEFORE = u('photo-1522708323590-d24dbb6b0267', 1000)
/** หน้าค้นหา Shopee ตามคำค้น (ไม่ใช่ประกาศเฉพาะชิ้น) */
export const shopeeSearchUrl = (keyword: string) => `https://shopee.co.th/search?keyword=${encodeURIComponent(keyword)}`

// รูปคือภาพตัวอย่างสไตล์ ใช้เป็น "หลังแต่ง" ตอนยังไม่ได้ต่อ AI
// Record<StyleId> = ขาดหรือเกินจาก STYLE_IDS (lib/styles.ts) แล้ว compile ไม่ผ่าน
const STYLE_IMAGES: Record<StyleId, string> = {
  minimal: 'photo-1600210492486-724fe5c67fb0',
  muji: 'photo-1600607687939-ce8a6c25118c',
  japandi: 'photo-1616486338812-3dadae4b4ace',
  scandi: 'photo-1615874694520-474822394e73',
  loft: 'photo-1502672260266-1c1ef2d93688',
  luxe: 'photo-1600607687920-4e2a09cf159d',
  boho: 'photo-1618221195710-dd6b41faaea6',
  nordic: 'photo-1600210491892-03d54c0aaf87',
}
export const STYLES = STYLE_IDS.map(id => ({id, name: t[id], image: STYLE_IMAGES[id]}))
export const styleImage = (id: string, w = 1000) => u(STYLES.find(s => s.id === id)?.image ?? STYLES[0].image, w)
export const styleName = (id: string) => STYLES.find(s => s.id === id)?.name ?? id

export const ROOM_TYPES = ROOM_TYPE_IDS
export const roomName = (id: string) => (t as Record<string, string>)[id] ?? id

/** สิ่งที่ผู้ใช้เลือกตลอด flow เก็บใน sessionStorage */
export type Plan = {style: string; roomType: string; budget: number; width: number; areaM2?: number | null; need?: string; sample?: boolean; remixOf?: string}
// ค่าเริ่มต้นคือสถานการณ์เดโม: มุมทำงานคอนโด 80 ซม. งบ 5,000
export const DEFAULT_PLAN: Plan = {style: 'japandi', roomType: 'condo', budget: 5000, width: 80}
// ปุ่มค่าลัดของช่องงบ/ความกว้าง ใช้ทั้งหน้าตั้งค่าและหน้าผลลัพธ์
export const BUDGET_PRESETS = [3500, 5000, 10000]
export const WIDTH_PRESETS = [60, 80, 120]

export function readJson<T>(store: 'session' | 'local', key: string, fallback: T): T {
  try {
    const raw = (store === 'session' ? sessionStorage : localStorage).getItem(key)
    return raw ? {...fallback, ...JSON.parse(raw)} : fallback
  } catch { return fallback }
}
/** คืน false ถ้าเขียนไม่ได้ (โหมดส่วนตัว หรือพื้นที่เต็ม) */
export function writeJson(store: 'session' | 'local', key: string, value: unknown): boolean {
  try { (store === 'session' ? sessionStorage : localStorage).setItem(key, JSON.stringify(value)); return true } catch { return false }
}
export const readPlan = () => readJson<Plan>('session', PLAN_KEY, DEFAULT_PLAN)
export const savePlan = (p: Partial<Plan>) => writeJson('session', PLAN_KEY, {...readPlan(), ...p})

/**
 * เริ่มเดโมใหม่ (ซ้อมพิตช์): ห้องตัวอย่าง + ค่าเริ่มต้น ล้างเฉพาะของในแท็บนี้ (รูป ชุด การจัดวาง)
 * ไม่แตะของส่วนตัวใน localStorage (ไลก์ เซฟ draft โพสต์)
 */
export function startDemoSession() {
  writeJson('session', PLAN_KEY, {...DEFAULT_PLAN, sample: true})
  writePlacement(EMPTY_PLACEMENT)
  try { for (const key of [FLOOR_PLAN_KEY, FURNITURE_SELECTION_KEY, RENDER_KEY, ROOM_IMAGES_KEY, STYLE_REFERENCE_KEY, PRODUCT_RENDER_KEY]) sessionStorage.removeItem(key) } catch {}
  try { sessionStorage.setItem(ROOM_IMAGE_KEY, BEFORE) } catch {}
}

type FeedItem = {name: string; priceRange?: string; keyword?: string; url?: string} // url = exact listing (no price shown)

export type FeedPost = {
  id: string
  user: string
  roomLabel: string
  style: string
  roomType: string
  budget?: number
  width?: number
  before: string | null // null = no verified owner photo yet (card shows a labelled empty slot)
  after: string | null
  items: FeedItem[]
  local?: boolean // โพสต์ที่ผู้ใช้แชร์เอง เก็บใน localStorage เครื่องนี้เท่านั้น
  aiRender?: boolean // ภาพผลลัพธ์ AI ที่แชร์จากเซิร์ฟเวอร์
  example?: boolean // โพสต์ตัวอย่างของทีม
}

// โพสต์ตัวอย่างจากห้องจริงของทีม ยังไม่มีรูป จนกว่าจะมีรูป Before ที่ยืนยัน SHA256 แล้วและ After จาก Codex (เฉพาะเครื่อง)
// ไม่มีรูป stock แทน ของในโพสต์เป็นประกาศ Shopee จริงตาม id (lib/feed-examples.ts)
export const FEED: FeedPost[] = EXAMPLE_POSTS.map(p => ({
  id: p.id, user: 'ตัวอย่างจากทีม', roomLabel: p.roomLabel, style: p.style, roomType: p.roomType,
  before: null, after: null, example: true, items: p.items.map(i => ({name: i.name, url: i.url})),
}))

// ฟีดบนเครื่องนี้: ไลก์ เซฟ และโพสต์ที่ผู้ใช้กดแชร์เอง ทั้งหมดอยู่ใน localStorage ไม่มีการส่งออกไปไหน
export type Social = {likes: string[]; saves: string[]; posts: FeedPost[]}
export const EMPTY_SOCIAL: Social = {likes: [], saves: [], posts: []}
export const readSocial = () => readJson<Social>('local', SOCIAL_KEY, EMPTY_SOCIAL)
export const writeSocial = (s: Social) => writeJson('local', SOCIAL_KEY, s)

// ---- Placement (product first): วางรูปสินค้าบนรูปห้องของผู้ใช้ ทั้งหมดอยู่ในแท็บนี้ ไม่ส่งรูปออก ----
export type Pos = {x: number; y: number; w: number} // เปอร์เซ็นต์ของกรอบรูปห้อง (มุมซ้ายบน, ความกว้าง)
// set = id ของชุดปัจจุบัน (หลังกดปรับงบ/ขนาด) เพื่อให้เปลี่ยนเฉพาะชิ้นที่จำเป็น ไม่สุ่มใหม่ทั้งชุด
export type Placement = {pos: Record<string, Pos>; photos: Record<string, string>; locked: Product[]; set?: string[]}
export const EMPTY_PLACEMENT: Placement = {pos: {}, photos: {}, locked: []}
export const readPlacement = () => readJson<Placement>('session', PLACEMENT_KEY, EMPTY_PLACEMENT)
export const writePlacement = (p: Placement) => writeJson('session', PLACEMENT_KEY, p)

// listing แรกที่ทีมเจอ (โคมไฟหนีบ) ยังไม่ยืนยันราคา/ขนาด ผู้ใช้ต้องกรอกเองจากหน้า listing ก่อนล็อกเข้าชุด
export const EXAMPLE_LISTING = {name: 'โคมไฟหนีบ', url: 'https://shopee.co.th/product/1272585684/27313552963'}

/** รับเฉพาะลิงก์ https ของ shopee.co.th (ไม่ fetch แค่เปิดในแท็บใหม่) */
export function shopeeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' && (u.hostname === 'shopee.co.th' || u.hostname.endsWith('.shopee.co.th')) ? u.toString() : null
  } catch { return null }
}

/** ภาพตัวอย่างสินค้า (demo fixture) วาดเป็น SVG ในเครื่อง ไม่ใช่รูปสินค้าจริง */
export function demoProductImage(name: string) {
  const esc = name.replace(/[<>&"]/g, '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160"><rect width="200" height="160" rx="18" fill="#F5E1D7" fill-opacity="0.92"/><text x="100" y="72" font-family="sans-serif" font-size="17" text-anchor="middle" fill="#2E2622">${esc}</text><text x="100" y="104" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#98452F">ภาพตัวอย่าง (demo)</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ---- Draft: บันทึกค่าที่เลือกไว้ใน localStorage เครื่องนี้ ไม่เก็บรูปใดๆ ----
export type Draft = {id: string; savedAt: number; plan: Plan; items: string[]; locked: Product[]; furniture?: Furniture[]; renderJob?: Job; photoCount?: number}
export const readDrafts = () => readJson<{list: Draft[]}>('local', DRAFTS_KEY, {list: []}).list
export const writeDrafts = (list: Draft[]) => writeJson('local', DRAFTS_KEY, {list})
