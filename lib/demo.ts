import {t} from '@/lib/copy'

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
  try { sessionStorage.removeItem(RENDER_KEY) } catch {}
  try { sessionStorage.setItem(ROOM_IMAGE_KEY, BEFORE) } catch {}
}

export type FeedItem = {name: string; priceRange: string; keyword: string}

export type FeedPost = {
  id: string
  user: string
  roomLabel: string
  style: string
  roomType: string
  budget: number
  width: number
  before: string
  after: string
  items: FeedItem[]
  local?: boolean // โพสต์ที่ผู้ใช้แชร์เอง เก็บใน localStorage เครื่องนี้เท่านั้น
}

// ฟีดตัวอย่างสำหรับเดโม ยังไม่ใช่ผลงานผู้ใช้จริง
export const FEED: FeedPost[] = [
  { id: 'p1', user: 'พิม', roomLabel: 'มุมทำงานคอนโด 80 ซม.', style: 'muji', roomType: 'condo', budget: 5000, width: 80, before: u('photo-1522708323590-d24dbb6b0267'), after: u('photo-1616594039964-ae9021a400a0'), items: [{name:'โคมไฟเพดานไม้',priceRange:'฿450–2,000',keyword:'โคมไฟเพดาน นอร์ดิก'},{name:'ม้านั่งเก็บของ',priceRange:'฿590–2,200',keyword:'ม้านั่ง เก็บของ ฝาเปิด'},{name:'พรมผืนเล็กกันลื่น',priceRange:'฿150–700',keyword:'พรมผืนเล็ก กันลื่น'}] },
  { id: 'p2', user: 'ต้น', roomLabel: 'ห้องนอน', style: 'japandi', roomType: 'bedroom', budget: 4000, width: 120, before: u('photo-1505693416388-ac5ce068fe85'), after: u('photo-1616627561950-9f746e330187'), items: [{name:'โคมไฟหัวเตียง',priceRange:'฿250–900',keyword:'โคมไฟตั้งโต๊ะ ข้างเตียง'},{name:'ผ้านวมสีเอิร์ธโทน',priceRange:'฿450–1,800',keyword:'ชุดผ้านวม สีเบจ'},{name:'โต๊ะข้างเตียงไม้',priceRange:'฿450–1,600',keyword:'โต๊ะข้างเตียง ไม้ 2 ชั้น'}] },
  { id: 'p3', user: 'แนน', roomLabel: 'ห้องนั่งเล่น', style: 'scandi', roomType: 'living', budget: 15000, width: 250, before: u('photo-1484154218962-a197022b5858'), after: u('photo-1493809842364-78817add7ffb'), items: [{name:'โซฟา 2 ที่นั่งผ้า',priceRange:'฿2,500–9,000',keyword:'โซฟา 2 ที่นั่ง ผ้า'},{name:'โต๊ะกลางไม้ทรงกลม',priceRange:'฿790–3,500',keyword:'โต๊ะกลาง ไม้ ทรงกลม'},{name:'หมอนอิงผ้าลินิน',priceRange:'฿89–400',keyword:'หมอนอิง ปลอกผ้าลินิน'}] },
  { id: 'p4', user: 'เจ', roomLabel: 'ห้องโล่ง', style: 'loft', roomType: 'empty', budget: 8000, width: 200, before: u('photo-1536376072261-38c75010e6c9'), after: u('photo-1524758631624-e2822e304c36'), items: [{name:'ชั้นวางโมดูลาร์ต่อได้',priceRange:'฿490–2,500',keyword:'ชั้นวางของ ทรงคิวบ์'},{name:'บีนแบ็กผ้าแคนวาส',priceRange:'฿590–2,200',keyword:'โซฟานั่งพื้น'},{name:'โคมไฟตั้งพื้นขาสามขา',priceRange:'฿690–2,800',keyword:'โคมไฟตั้งพื้น'}] },
]

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
