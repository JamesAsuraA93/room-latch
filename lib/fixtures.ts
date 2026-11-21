import type {Product} from '@/lib/plan'
import {STYLE_IDS} from './styles.ts'

// ของตัวอย่าง (fixture) สำหรับมุมทำงานคอนโด: โต๊ะ เก้าอี้ ไฟ ครบทุกสไตล์ที่ UI เลือกได้
// ราคา/ขนาด/รุ่นเป็นค่าสมมติของทีม ไม่ใช่สินค้าจริงบน Shopee ชื่อลงท้าย (fixture) เสมอ ปุ่มเป็นหน้าค้นหา ไม่ใช่ประกาศ
// เก้าอี้เก็บใต้โต๊ะได้ จึงไม่นับความกว้างพื้น (floor: false) แต่ยังต้องไม่กว้างเกินมุม
export const FIXTURE_TAG = '(fixture)'
const ALL = [...STYLE_IDS]
const NATURAL = ['japandi', 'muji', 'scandi', 'nordic', 'minimal']

// LISTING = ประกาศ Shopee จริงที่ทีมเปิดดูหน้าสินค้าแล้ว (Chrome อ่านอย่างเดียว 21 พ.ย. 2026) ยืนยันแค่ชื่อสินค้า/ลิงก์
// ราคา ขนาดจริง และตัวเลือก (เช่น 80 ซม. หรือรุ่นไม้) ยังไม่ยืนยัน ราคาในเดโมยังเป็นค่าตัวอย่าง
const LISTING: Record<string, string> = {
  'desk-wood-80': 'https://shopee.co.th/product/1472021144/29480807814', // โต๊ะคอม โต๊ะทำงาน ไม้จริง ... 140/120/100/80cm ไม้ยางพารา
  'desk-steel-60': 'https://shopee.co.th/product/51182838/43212578200', // โต๊ะอเนกประสงค์ ขาสามด้าน หน้าไม้ยางพารา ขาเหล็ก 40×60
  'chair-wood': 'https://shopee.co.th/product/61666595/15632842792', // เก้าอี้ไม้ พนักพิงสูง เคลือบเงา
  'lamp-wood': 'https://shopee.co.th/product/1526739684/41602262803', // โคมไฟหัวเตียง โคมไฟตั้งโต๊ะ แสงอุ่น (มีตัวเลือก รุ่นไม้)
}

const item = (id: string, slot: string, name: string, keyword: string, price: number, widthCm: number, floor: boolean, styles: string[], priority = 1): Product => ({
  id: `fixture-${id}`, roomType: 'condo', slot, name: `${name} ${FIXTURE_TAG}`, keyword,
  styles, priceMin: price, priceMax: price, priority, deeplink: LISTING[id] ?? '', widthCm, floor,
})

export const FIXTURES: Product[] = [
  // โต๊ะ
  item('desk-wood-80', 'desk', 'โต๊ะทำงานไม้ 80 ซม.', 'โต๊ะทำงาน ไม้ 80 ซม', 2190, 80, true, NATURAL),
  item('desk-steel-60', 'desk', 'โต๊ะทำงานขาเหล็ก 60 ซม.', 'โต๊ะทำงาน ขาเหล็ก 60 ซม', 790, 60, true, ALL),
  item('desk-marble-80', 'desk', 'โต๊ะทำงานลายหินอ่อน 80 ซม.', 'โต๊ะทำงาน ลายหินอ่อน', 2490, 80, true, ['luxe']),
  item('desk-loft-80', 'desk', 'โต๊ะทำงานไม้เก่าขาเหล็ก 80 ซม.', 'โต๊ะทำงาน ลอฟท์ ขาเหล็ก', 1990, 80, true, ['loft']),
  item('desk-rattan-75', 'desk', 'โต๊ะทำงานขาหวาย 75 ซม.', 'โต๊ะทำงาน หวาย', 1890, 75, true, ['boho']),
  item('desk-wide-120', 'desk', 'โต๊ะทำงานยาว 120 ซม.', 'โต๊ะทำงาน 120 ซม', 2490, 120, true, NATURAL),
  // เก้าอี้
  item('chair-wood', 'chair', 'เก้าอี้ไม้พนักโค้ง', 'เก้าอี้ไม้ พนักพิง', 1290, 45, false, NATURAL),
  item('chair-steel', 'chair', 'เก้าอี้เหล็กเบาะหนัง', 'เก้าอี้เหล็ก เบาะหนัง', 990, 45, false, ['loft', 'minimal']),
  item('chair-velvet', 'chair', 'เก้าอี้กำมะหยี่', 'เก้าอี้ กำมะหยี่', 1490, 50, false, ['luxe']),
  item('chair-rattan', 'chair', 'เก้าอี้หวาย', 'เก้าอี้หวาย', 1190, 50, false, ['boho']),
  item('chair-basic', 'chair', 'เก้าอี้พลาสติกเรียบ', 'เก้าอี้พลาสติก', 490, 45, false, ALL, 2),
  // ไฟ (slot เดียวกับ lighting ใน catalog: ชุดหนึ่งมีไฟชิ้นเดียว)
  item('lamp-wood', 'lighting', 'โคมตั้งโต๊ะขาไม้', 'โคมไฟตั้งโต๊ะ ขาไม้', 690, 20, false, NATURAL),
  item('lamp-black', 'lighting', 'โคมตั้งโต๊ะเหล็กดำ', 'โคมไฟตั้งโต๊ะ เหล็ก สีดำ', 590, 20, false, ['loft', 'minimal']),
  item('lamp-brass', 'lighting', 'โคมตั้งโต๊ะทองเหลือง', 'โคมไฟตั้งโต๊ะ ทองเหลือง', 1190, 20, false, ['luxe']),
  item('lamp-rattan', 'lighting', 'โคมตั้งโต๊ะหวาย', 'โคมไฟตั้งโต๊ะ หวาย', 790, 25, false, ['boho']),
]
export const isFixture = (p: Product) => p.id.startsWith('fixture-')
