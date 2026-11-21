import {ResultView} from '@/components/result-view'
import {loadCatalog, loadRealCatalog} from '@/lib/catalog'
import {liveProvider} from '@/lib/live-render-core'
import {realListings} from '@/lib/db'

export const dynamic = 'force-dynamic'

// อ่าน catalog ฝั่ง server ตอน build แล้วส่งให้ client คำนวณชุดเอง (ไม่ต้องมี API)
export default async function Result() {
  // สินค้าจริงอ่านจาก Neon; ถ้า DB ใช้ไม่ได้ (เช่นไม่มี DATABASE_URL) กลับไปใช้ snapshot CSV เดิม
  const real = await realListings().catch(e => { console.error('realListings failed, using CSV snapshot', (e as Error).message); return loadRealCatalog() })
  // null = ยังไม่เปิดสร้างภาพด้วย AI บน server นี้ (local ใช้ codex, production ใช้ openai ดู liveProvider)
  return <ResultView products={loadCatalog()} live={liveProvider(process.env)} real={real} />
}
