import {ResultView} from '@/components/result-view'
import {loadCatalog, loadRealCatalog} from '@/lib/catalog'
import {liveProvider} from '@/lib/live-render-core'

// อ่าน catalog ฝั่ง server ตอน build แล้วส่งให้ client คำนวณชุดเอง (ไม่ต้องมี API)
export default function Result() {
  // ปุ่มสร้างภาพด้วย AI โผล่เฉพาะเมื่อ server เปิด provider ไว้ (ในเครื่องเท่านั้น, Vercel = null เสมอ)
  return <ResultView products={loadCatalog()} live={liveProvider(process.env)} real={loadRealCatalog()} />
}
