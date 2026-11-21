// เลือกชุดของจาก catalog/products.csv ให้ลงงบรวมและความกว้างมุมที่ผู้ใช้กรอก
// ไม่เดาขนาดจากรูป: งบและความกว้างมาจากช่องกรอกเท่านั้น ราคาใช้ price_max (กรณีแพงสุดของช่วงประมาณ)

export type Product = {
  id: string
  roomType: string
  slot: string
  name: string
  keyword: string
  styles: string[]
  priceMin: number
  priceMax: number
  priority: number
  deeplink: string
  widthCm: number | null // null = ของผ้า/ของชิ้นเล็ก ไม่กินความกว้าง
  floor: boolean // true = วางพื้น กินความกว้างมุมรวมกัน
}

export type PlanInput = {roomType: string; style: string; budget: number; width: number}
export type PlanResult = {items: Product[]; total: number; floorWidth: number}

// ขนาดตัวอย่าง (demo fixture) ยังไม่ใช่ขนาดสินค้าจริงบน Shopee ต้องแสดงป้ายนี้ทุกครั้งที่โชว์ขนาด
// key = item_th ใน products.csv
export const DEMO_SIZE: Record<string, [number | null, boolean]> = {
  'โคมไฟตั้งพื้นขาไม้': [35, true], 'โคมไฟหัวเตียง': [20, false], 'ผ้าปูที่นอนสีพื้น': [null, false], 'ผ้านวมสีเอิร์ธโทน': [null, false],
  'ผ้าม่านทึบแสงสีครีม': [null, false], 'พรมข้างเตียงขนสั้น': [60, false], 'โต๊ะข้างเตียงไม้': [40, true], 'ตู้ลิ้นชักไม้': [80, true],
  'กระจกเต็มตัวขอบไม้': [45, true], 'ภาพแขวนผนังมินิมอล': [50, false], 'ต้นไม้ปลอมกระถางสาน': [30, true],
  'โซฟา 2 ที่นั่งผ้า': [150, true], 'โซฟาเบดปรับนอน': [180, true], 'พรมลายเรขาคณิต': [160, false], 'โต๊ะกลางไม้ทรงกลม': [80, true],
  'ตู้วางทีวีไม้เตี้ย': [120, true], 'โคมไฟตั้งพื้นทรงโค้ง': [90, true], 'ไฟเส้น LED แสงอุ่น': [null, false], 'ผ้าม่านโปร่งลินิน': [null, false],
  'ชั้นวางติดผนังไม้': [60, false], 'หมอนอิงผ้าลินิน': [null, false], 'ต้นไม้ปลอมต้นสูง': [45, true], 'นาฬิกาแขวนผนังมินิมอล': [30, false],
  'โต๊ะพับติดผนัง': [80, true], 'เก้าอี้บาร์สตูล': [35, true], 'ม้านั่งเก็บของ': [80, true], 'ฉากกั้นห้องไม้ระแนง': [120, true],
  'ชั้นวางของ 5 ชั้นแคบ': [40, true], 'โคมไฟเพดานไม้': [40, false], 'กระจกติดผนังทรงโค้ง': [50, false], 'ที่แขวนผนังไม่เจาะ': [null, false],
  'พรมผืนเล็กกันลื่น': [60, false], 'ต้นไม้ตั้งโต๊ะกระถางเซรามิก': [15, false],
  'พรมผืนใหญ่ปูกลางห้อง': [200, false], 'บีนแบ็กผ้าแคนวาส': [80, true], 'เบาะรองนั่งญี่ปุ่น': [45, true], 'ชั้นวางโมดูลาร์ต่อได้': [70, true],
  'โคมไฟตั้งพื้นขาสามขา': [45, true], 'ผ้าม่านยาวจรดพื้น': [null, false], 'ภาพแขวนผนังขนาดใหญ่': [90, false], 'โต๊ะญี่ปุ่นเตี้ย': [70, true],
  'เซ็ตต้นไม้ปลอมตกแต่ง': [60, true],
  'กล่องเก็บของมีฝา': [40, true], 'ตู้ลิ้นชักพลาสติก': [40, true], 'ชั้นวางของอเนกประสงค์': [60, true], 'ตะกร้าสานเก็บของ': [35, true],
  'กล่องเก็บของใต้เตียง': [null, false], 'ราวแขวนเสื้อตั้งพื้น': [90, true], 'กล่องจัดระเบียบลิ้นชัก': [null, false], 'กล่องเก็บสายไฟ': [30, false],
}

export const MAX_ITEMS = 4

/** CSV แบบ RFC 4180 พอใช้กับไฟล์นี้: ช่องที่ครอบ " และ "" แทน " */
export function parseCsv(text: string): Record<string, string>[] {
  text = text.replace(/^\uFEFF/, '') // ไฟล์จาก Excel/Sheets มักมี BOM นำหน้า ทำให้ชื่อคอลัมน์แรกเพี้ยน
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some(Boolean)) rows.push(row)
  const [head, ...body] = rows
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

export function toProducts(rows: Record<string, string>[]): Product[] {
  return rows.map((r, i) => {
    const size = DEMO_SIZE[r.item_th]
    if (!size) throw new Error(`ไม่มีขนาดตัวอย่างของ ${r.item_th} ใน DEMO_SIZE`)
    return {
      id: `${r.room_type}-${i}`, roomType: r.room_type, slot: r.slot, name: r.item_th, keyword: r.keyword_th,
      styles: r.styles.split('|'), priceMin: Number(r.price_min), priceMax: Number(r.price_max), priority: Number(r.priority),
      deeplink: r.deeplink.trim(), widthCm: size[0], floor: size[1],
    }
  })
}

// มุมทำงาน: โต๊ะ เก้าอี้ ไฟ คือแกนของชุด ได้คะแนนเพิ่มเพื่อให้ชุดเริ่มต้นมีครบ
const CORE_SLOTS = ['desk', 'chair', 'lighting']
const score = (p: Product, _style: string) => (4 - p.priority) + (CORE_SLOTS.includes(p.slot) ? 3 : 0)
/** ของที่ใช้ได้กับห้อง/สไตล์นี้: ต้องตรงสไตล์ที่เลือกจริง ไม่มี fallback ข้ามสไตล์ */
const eligible = (p: Product, input: PlanInput) => p.roomType === input.roomType && p.styles.includes(input.style) && p.priceMax <= input.budget && (p.widthCm === null || p.widthCm <= input.width)

export function fits(items: Product[], {budget, width}: Pick<PlanInput, 'budget' | 'width'>) {
  const total = items.reduce((s, p) => s + p.priceMax, 0)
  const floorWidth = items.reduce((s, p) => s + (p.floor ? p.widthCm ?? 0 : 0), 0)
  const eachFits = items.every(p => p.widthCm === null || p.widthCm <= width)
  return {ok: total <= budget && floorWidth <= width && eachFits, total, floorWidth}
}

/**
 * ลองทุกชุดไม่เกิน MAX_ITEMS ชิ้น ห้าม slot ซ้ำ เลือกคะแนนสูงสุด เสมอกันเลือกชุดที่ใช้งบมากกว่า (ของดีขึ้นในงบเดิม)
 * locked = สินค้าที่ผู้ใช้เลือกเองจาก listing (product first) อยู่ในชุดเสมอ ที่เหลือเลือกให้ลงงบ/มุมที่เหลือ
 * ถ้า locked เองไม่ลง คืนชุดว่าง (lockedOk = false)
 */
export function pickSet(all: Product[], input: PlanInput, locked: Product[] = []): PlanResult & {lockedOk: boolean} {
  const base = fits(locked, input)
  if (!base.ok) return {items: [], total: 0, floorWidth: 0, lockedOk: false}
  const pool = all.filter(p => eligible(p, input) && !locked.some(l => l.slot === p.slot))
  const limit = Math.max(MAX_ITEMS, locked.length)
  let best: PlanResult = {items: [...locked], total: base.total, floorWidth: base.floorWidth}
  let bestScore = -1
  const walk = (start: number, chosen: Product[]) => {
    const f = fits(chosen, input)
    if (!f.ok) return
    const s = chosen.reduce((n, p) => n + score(p, input.style), 0)
    if (s > bestScore || (s === bestScore && f.total > best.total)) {
      best = {items: [...chosen], total: f.total, floorWidth: f.floorWidth}
      bestScore = s
    }
    if (chosen.length >= limit) return
    for (let i = start; i < pool.length; i++) {
      if (chosen.some(c => c.slot === pool[i].slot)) continue
      walk(i + 1, [...chosen, pool[i]])
    }
  }
  walk(0, [...locked])
  return {...best, lockedOk: true}
}

export type Change = {kind: 'removed' | 'replaced'; item: Product; from?: Product; why: string}
export type SwapResult = PlanResult & {lockedOk: boolean; changes: Change[]}

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`

/**
 * ปรับงบ/ความกว้างแล้วเปลี่ยน "เฉพาะชิ้นที่จำเป็น": เก็บชุดเดิมไว้ ลองเปลี่ยนให้น้อยชิ้นที่สุด
 * ลำดับที่เลือก: เปลี่ยนน้อยชิ้นสุด > แทนด้วยของ slot เดียวกัน (ดีกว่าเอาออกเฉยๆ) > คะแนนสูง > ใช้งบมากกว่า
 * locked (ของที่ผู้ใช้ล็อก) ไม่ถูกเปลี่ยนหรือปลดเงียบๆ ถ้า locked เองไม่ลง คืน lockedOk = false
 */
export function minimalSwap(all: Product[], prev: Product[], input: PlanInput, locked: Product[] = []): SwapResult {
  if (!fits(locked, input).ok) return {items: [], total: 0, floorWidth: 0, lockedOk: false, changes: []}
  const isLocked = (p: Product) => locked.some(l => l.id === p.id)
  const free = prev.filter(p => !isLocked(p))
  const before = fits(prev, input)
  if (before.ok && locked.every(l => prev.some(p => p.id === l.id))) return {items: prev, total: before.total, floorWidth: before.floorWidth, lockedOk: true, changes: []}
  const taken = new Set(prev.map(p => p.id))
  const alts = (p: Product) => all.filter(a => a.slot === p.slot && !taken.has(a.id) && eligible(a, input))
  type Cand = {items: Product[]; changed: number; replaced: number; score: number; total: number; floorWidth: number; picks: (Product | null)[]}
  let best: Cand | null = null
  const better = (a: Cand, b: Cand | null) => !b || a.changed < b.changed || (a.changed === b.changed && (a.replaced > b.replaced || (a.replaced === b.replaced && (a.score > b.score || (a.score === b.score && a.total > b.total)))))
  const walk = (i: number, picks: (Product | null)[]) => {
    if (i === free.length) {
      const items = [...locked, ...picks.filter((p): p is Product => p !== null)]
      const f = fits(items, input)
      if (!f.ok) return
      const cand: Cand = {items, picks, total: f.total, floorWidth: f.floorWidth, score: items.reduce((n, p) => n + score(p, input.style), 0),
        changed: picks.filter((p, k) => p?.id !== free[k].id).length, replaced: picks.filter((p, k) => p && p.id !== free[k].id).length}
      if (better(cand, best)) best = cand
      return
    }
    for (const option of [free[i], ...alts(free[i]), null]) walk(i + 1, [...picks, option])
  }
  walk(0, [])
  const b = best as Cand | null
  if (!b) return {items: [...locked], total: fits(locked, input).total, floorWidth: fits(locked, input).floorWidth, lockedOk: true, changes: []}
  const reason = before.total > input.budget ? `งบรวมเดิม ${baht(before.total)} เกินงบ ${baht(input.budget)}`
    : before.floorWidth > input.width ? `วางพื้นรวมเดิม ${before.floorWidth} ซม. เกินมุม ${input.width} ซม.` : 'มีชิ้นที่กว้างเกินมุม'
  const changes: Change[] = []
  free.forEach((old, k) => {
    const next = b.picks[k]
    if (next?.id === old.id) return
    changes.push(next ? {kind: 'replaced', item: next, from: old, why: reason} : {kind: 'removed', item: old, why: reason})
  })
  return {items: b.items, total: b.total, floorWidth: b.floorWidth, lockedOk: true, changes}
}

/** ราคา/ขนาดสั้นๆ ของชิ้นหนึ่ง ใช้ในคำอธิบายก่อน-หลัง */
export const spec = (p: Product) => `${baht(p.priceMax)}${p.widthCm !== null ? ` · ${p.widthCm} ซม.` : ''}`

/** ตอนไม่มีชุดไหนลง บอกค่าขั้นต่ำที่ต้องขยับ */
export function noFitHint(all: Product[], input: PlanInput) {
  const room = all.filter(p => p.roomType === input.roomType && p.styles.includes(input.style))
  const widthOk = room.filter(p => p.widthCm === null || p.widthCm <= input.width)
  const minBudget = widthOk.length ? Math.min(...widthOk.map(p => p.priceMax)) : null
  const minWidth = Math.min(...room.filter(p => p.priceMax <= input.budget).map(p => p.widthCm ?? 0).concat(Infinity))
  return {minBudget, minWidth: Number.isFinite(minWidth) ? minWidth : null}
}
