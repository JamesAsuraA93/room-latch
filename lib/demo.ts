import {t} from '@/lib/copy'
import {EXAMPLE_POSTS} from '@/lib/feed-examples'

const u = (id: string, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`

export const BEFORE = u('photo-1522708323590-d24dbb6b0267', 1000)
export const ROOM_IMAGE_KEY = 'room-ai-photo'
export const PLAN_KEY = 'room-ai-plan'
export const SHOPEE_SEARCH = 'https://shopee.co.th/search?keyword='

// key ตรงกับคอลัมน์ styles ใน catalog/products.csv รูปคือภาพตัวอย่างสไตล์ ใช้เป็น "หลังแต่ง" ตอนยังไม่ได้ต่อ AI
export const STYLES = [
  {id: 'minimal', name: t.minimal, image: 'photo-1600210492486-724fe5c67fb0'},
  {id: 'muji', name: t.muji, image: 'photo-1600607687939-ce8a6c25118c'},
  {id: 'japandi', name: t.japandi, image: 'photo-1616486338812-3dadae4b4ace'},
  {id: 'scandi', name: t.scandi, image: 'photo-1615874694520-474822394e73'},
  {id: 'loft', name: t.loft, image: 'photo-1600566753190-17f0baa2a6c3'},
  {id: 'luxe', name: t.luxe, image: 'photo-1600607687920-4e2a09cf159d'},
  {id: 'boho', name: t.boho, image: 'photo-1618221195710-dd6b41faaea6'},
  {id: 'nordic', name: t.nordic, image: 'photo-1600210491892-03d54c0aaf87'},
] as const
export const styleImage = (id: string, w = 1000) => u(STYLES.find(s => s.id === id)?.image ?? STYLES[0].image, w)
export const styleName = (id: string) => STYLES.find(s => s.id === id)?.name ?? id

export const ROOM_TYPES = ['condo', 'bedroom', 'living', 'empty', 'cluttered'] as const
export const roomName = (id: string) => (t as Record<string, string>)[id] ?? id

/** สิ่งที่ผู้ใช้เลือกตลอด flow เก็บใน sessionStorage */
export type Plan = {style: string; roomType: string; budget: number; width: number; sample?: boolean; remixOf?: string}
// ค่าเริ่มต้นคือสถานการณ์เดโม: มุมทำงานคอนโด 80 ซม. งบ 5,000
export const DEFAULT_PLAN: Plan = {style: 'japandi', roomType: 'condo', budget: 5000, width: 80}

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
  writeJson('session', PLACEMENT_KEY, {pos: {}, photos: {}, locked: []})
  try { sessionStorage.removeItem(RENDER_KEY); sessionStorage.removeItem('room-ai-photos') } catch {}
  try { sessionStorage.setItem(ROOM_IMAGE_KEY, BEFORE) } catch {}
}

export type FeedItem = {name: string; priceRange?: string; keyword?: string; url?: string} // url = exact listing (no price shown)

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
  example?: boolean // โพสต์ตัวอย่างของทีม
}

// โพสต์ตัวอย่างจากห้องจริงของทีม ยังไม่มีรูป จนกว่าจะมีรูป Before ที่ยืนยัน SHA256 แล้วและ After จาก Codex (เฉพาะเครื่อง)
// ไม่มีรูป stock แทน ของในโพสต์เป็นประกาศ Shopee จริงตาม id (lib/feed-examples.ts)
export const FEED: FeedPost[] = EXAMPLE_POSTS.map(p => ({
  id: p.id, user: 'ตัวอย่างจากทีม', roomLabel: p.roomLabel, style: p.style, roomType: p.roomType,
  before: null, after: null, example: true, items: p.items.map(i => ({name: i.name, url: i.url})),
}))

// ฟีดบนเครื่องนี้: ไลก์ เซฟ และโพสต์ที่ผู้ใช้กดแชร์เอง ทั้งหมดอยู่ใน localStorage ไม่มีการส่งออกไปไหน
export const SOCIAL_KEY = 'room-ai-social'
export type Social = {likes: string[]; saves: string[]; posts: FeedPost[]}
export const EMPTY_SOCIAL: Social = {likes: [], saves: [], posts: []}
export const readSocial = () => readJson<Social>('local', SOCIAL_KEY, EMPTY_SOCIAL)
export const writeSocial = (s: Social) => writeJson('local', SOCIAL_KEY, s)

// ---- Placement (product first): วางรูปสินค้าบนรูปห้องของผู้ใช้ ทั้งหมดอยู่ในแท็บนี้ ไม่ส่งรูปออก ----
import type {Product} from '@/lib/plan'

export const PLACEMENT_KEY = 'room-ai-placement'
// ผลจาก /api/render ล่าสุด (provider, jobId) ไม่มีรูป
export const RENDER_KEY = 'room-ai-render'
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
export const DRAFTS_KEY = 'room-ai-drafts'
export type Draft = {id: string; savedAt: number; plan: Plan; items: string[]; locked: Product[]}
export const readDrafts = () => readJson<{list: Draft[]}>('local', DRAFTS_KEY, {list: []}).list
export const writeDrafts = (list: Draft[]) => writeJson('local', DRAFTS_KEY, {list})
