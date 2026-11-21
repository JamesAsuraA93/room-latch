// รัน: npm test (Node 22.6+ อ่าน TypeScript ได้เอง)
import assert from 'node:assert/strict'
import {existsSync, readFileSync} from 'node:fs'
import {parseCsv, toProducts, pickSet, fits, minimalSwap, noFitHint, type Product} from '../lib/plan.ts'
import {FIXTURES, isFixture} from '../lib/fixtures.ts'
import {EXACT_LISTINGS, exactFor} from '../lib/listings.ts'

const catalog = toProducts(parseCsv(readFileSync(new URL('../../catalog/products.csv', import.meta.url), 'utf8')))
assert.equal(catalog.length, 50)
const all = [...catalog, ...FIXTURES]

// ชุดเริ่มต้นของเดโม: มุมทำงานคอนโด 80 ซม. งบ 5,000
const wide = {roomType: 'condo', style: 'japandi', budget: 5000, width: 80}
const a = pickSet(all, wide)
assert.ok(fits(a.items, wide).ok)
const deskA = a.items.find(p => p.slot === 'desk')
assert.ok(deskA, 'demo set at ฿5,000 should include a desk')
assert.ok(a.items.every(p => p.widthCm === null || p.widthCm <= 80), 'nothing wider than the 80 cm corner')
console.log('5000:', a.items.map(p => `${p.name} ${p.priceMax} ${p.widthCm}`), a.total, a.floorWidth)

// wow: ลดงบเป็น 3,500 ต้องเปลี่ยนเฉพาะชิ้นที่จำเป็น (โต๊ะ) ที่เหลือคงเดิม
const tight = {...wide, budget: 3500}
const b = minimalSwap(all, a.items, tight)
assert.ok(b.lockedOk)
assert.ok(fits(b.items, tight).ok)
assert.equal(b.changes.length, 1, 'only one item should change')
const c = b.changes[0]
assert.equal(c.kind, 'replaced')
assert.equal(c.from!.slot, 'desk'); assert.equal(c.item.slot, 'desk')
assert.ok(isFixture(c.item), 'replacement desk is a labelled fixture')
assert.ok(c.item.widthCm! <= 80)
assert.deepEqual(b.items.filter(p => p.id !== c.item.id).map(p => p.id).sort(), a.items.filter(p => p.id !== c.from!.id).map(p => p.id).sort())
console.log('3500:', b.items.map(p => `${p.name} ${p.priceMax} ${p.widthCm}`), b.total, '|', `${c.from!.name} → ${c.item.name}: ${c.why}`)

// เดโมหลัก: ทุกชิ้น (รวมโต๊ะที่มาแทนตอน ฿3,500) ต้องลิงก์ไปหน้าสินค้าจริง ไม่ใช่หน้าค้นหา
const PRODUCT_URL = /^https:\/\/shopee\.co\.th\/product\/\d+\/\d+$/
for (const p of [...a.items, ...b.items]) assert.match(p.deeplink, PRODUCT_URL, `${p.name} should link to a product page`)

// งบพอแล้วต้องไม่เปลี่ยนอะไร
assert.equal(minimalSwap(all, a.items, wide).changes.length, 0)

// ล็อกของที่ผู้ใช้เลือก (มีราคา): ไม่ถูกปลดเงียบๆ ถ้าล็อกแล้วไม่พอ = no-fit
const lamp: Product = {id: 'custom-1', roomType: 'condo', slot: 'custom-1', name: 'โคมไฟหนีบ', keyword: '', styles: ['japandi'], priceMin: 600, priceMax: 600, priority: 1, deeplink: 'https://shopee.co.th/product/1', widthCm: null, floor: false}
const withLamp = minimalSwap(all, [lamp, ...a.items], tight, [lamp])
assert.ok(withLamp.lockedOk && withLamp.items.some(p => p.id === 'custom-1'))
assert.ok(fits(withLamp.items, tight).ok)
const broke = minimalSwap(all, [lamp, ...a.items], {...tight, budget: 500}, [lamp])
assert.equal(broke.lockedOk, false, 'locked ฿600 item cannot fit ฿500: no-fit, not silently unlocked')
assert.equal(pickSet(all, tight, [{...lamp, widthCm: 100, floor: true}]).lockedOk, false, '100 cm item cannot lock into 80 cm corner')

// ไม่มีชุดไหนลงเลย
assert.equal(pickSet(all, {...wide, budget: 50}).items.length, 0)
assert.ok(noFitHint(all, {...wide, budget: 50}).minBudget! > 50)

// ประกาศจริง: รูป+ลิงก์เท่านั้น ห้ามมีราคา/ขนาดแต่ง ลิงก์ต้องเป็นหน้าประกาศ ไม่ใช่หน้าค้นหา
for (const l of EXACT_LISTINGS) {
  assert.equal(l.priceTHB, null); assert.equal(l.widthCm, null)
  assert.match(l.url, /^https:\/\/shopee\.co\.th\/product\/\d+\/\d+$/)
  if (l.image) assert.ok(existsSync(new URL(`../public${l.image}`, import.meta.url)), `missing ${l.image}`)
}
assert.equal(exactFor('condo').length, 1)

// regression: ทุกสไตล์ที่ UI เลือกได้ ต้องมีชุดเริ่มต้นที่ลงงบ/มุมค่าเริ่มต้น และครบ โต๊ะ เก้าอี้ ไฟ
const demoSrc = readFileSync(new URL('../lib/demo.ts', import.meta.url), 'utf8')
const styleIds = [...demoSrc.slice(demoSrc.indexOf('export const STYLES'), demoSrc.indexOf('] as const')).matchAll(/id: '(\w+)'/g)].map(m => m[1])
assert.equal(styleIds.length, 8)
const DEFAULT = {roomType: 'condo', budget: 5000, width: 80}
for (const style of styleIds) {
  const input = {...DEFAULT, style}
  const set = pickSet(all, input)
  const label = `${style}: ${set.items.map(p => `${p.name} ${p.priceMax}`).join(', ')} = ${set.total}/${set.floorWidth}cm`
  assert.ok(fits(set.items, input).ok, label)
  for (const slot of ['desk', 'chair', 'lighting']) assert.ok(set.items.some(p => p.slot === slot), `${style} missing ${slot}`)
  assert.ok(set.items.every(p => p.styles.includes(style)), `${style} has unstyled item`)
  assert.equal(new Set(set.items.map(p => p.id)).size, set.items.length, `${style} duplicate id`)
  assert.equal(new Set(set.items.map(p => p.slot)).size, set.items.length, `${style} duplicate slot`)
  assert.ok(set.items.every(p => p.widthCm === null || p.widthCm <= 80))
  // ลดงบ: ต้องลงตัวด้วยการเปลี่ยนบางชิ้น หรือบอก no-fit ชัดๆ (ไม่มีชุดที่เกินงบหลุดออกมา)
  const cut = minimalSwap(all, set.items, {...input, budget: 3500})
  assert.ok(fits(cut.items, {...input, budget: 3500}).ok, `${style} ฿3,500 result must fit`)
  console.log(label, '| 3500 →', cut.total, cut.changes.map(c => c.kind === 'replaced' ? `${c.from!.name}→${c.item.name}` : `-${c.item.name}`).join(', ') || '(no change)')
}
console.log('ok')
