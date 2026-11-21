import {readFileSync} from 'node:fs'
import path from 'node:path'
import {parseCsv, toProducts} from '@/lib/plan'
import {FIXTURES} from '@/lib/fixtures'
import {mergeReal, toRealProducts} from '@/lib/real-catalog'

// อ่าน catalog/products.csv ตอน build (หน้าเป็น static) แก้ CSV แล้วต้อง build ใหม่
export const loadCatalog = () => [...toProducts(parseCsv(readFileSync(path.join(process.cwd(), '..', 'catalog', 'products.csv'), 'utf8'))), ...FIXTURES]

// สินค้าจริงจาก Shopee แบบ snapshot คงที่ (ไม่ใช่ API สด) แยกจาก engine งบ/ขนาด
const readCsv = (name: string) => parseCsv(readFileSync(path.join(process.cwd(), '..', 'catalog', name), 'utf8'))
// snapshot ใช้แท็กสไตล์แบบ alias เดิม, additions ใช้ชื่อสไตล์ของแอปตรงๆ
export const loadRealCatalog = () => mergeReal(toRealProducts(readCsv('shopee-real-snapshot.csv'), 'alias'), toRealProducts(readCsv('shopee-real-additions.csv'), 'direct'))
