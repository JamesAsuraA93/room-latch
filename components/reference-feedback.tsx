import Link from 'next/link'
import {referenceCompleteness} from '@/lib/room-images'
export function ReferenceFeedback({count}: {count: number}) {
  const percent = referenceCompleteness(count)
  return <section className="space-y-2 rounded-2xl border border-brand/20 bg-brand-soft p-4" aria-label="ข้อมูลภาพอ้างอิง">
    <h2 className="font-semibold">ความครบถ้วนของภาพอ้างอิง {percent}%</h2>
    <progress value={percent} max={100} aria-label="ความครบถ้วนของภาพอ้างอิง" className="h-2 w-full accent-[var(--color-brand)]" />
    <p className="text-sm">แนบแล้ว {count}/4 รูป · คะแนนนี้คำนวณจากจำนวนรูป ไม่ใช่เปอร์เซ็นต์ความแม่นยำของผลลัพธ์ ระบบยังไม่ได้วัดความแม่นยำจริง</p>
    <p className="text-sm">เพื่อช่วยให้ AI เข้าใจห้องได้แม่นยำขึ้น เพิ่มภาพจากมุมอื่นให้เห็นประตู หน้าต่าง และผนัง หรือแนบรูปแปลนห้องที่มีขนาดกำกับ ใช้ภาพชัดและแสงเพียงพอ</p>
    {count >= 4 && <p className="text-sm">ครบ 4 รูปแล้ว? เปลี่ยนภาพมุมซ้ำเป็นมุมที่ยังไม่เห็นหรือแปลนห้องได้ ภาพครบไม่ได้รับประกันความแม่นยำ</p>}
    <Link href="/upload" className="inline-block text-sm font-semibold text-brand underline">เพิ่มหรือเปลี่ยนภาพอ้างอิง</Link>
  </section>
}
