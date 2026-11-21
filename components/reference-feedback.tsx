import Link from 'next/link'
import {referenceCompleteness} from '@/lib/room-images'
import {Images, ArrowUpRight} from 'lucide-react'
export function ReferenceFeedback({count}: {count: number}) {
  const percent = referenceCompleteness(count)
  return <details className="rl-disclosure">
    <summary className="list-none"><span className="flex items-center gap-3"><Images className="size-5 text-brand" /><span className="flex-1">ภาพอ้างอิง {count}/4 รูป<span className="mt-1 block text-[11px] font-normal text-zinc-500">ความครบถ้วน {percent}% · ไม่ใช่ค่าความแม่นยำ</span></span><span className="text-lg text-brand">+</span></span></summary>
    <div className="space-y-3 text-xs leading-6 text-zinc-500">
      <progress value={percent} max={100} aria-label="ความครบถ้วนของภาพอ้างอิง" className="h-1.5 w-full accent-[var(--color-brand)]" />
      <p>เพิ่มภาพต่างมุมให้เห็นประตู หน้าต่าง และผนัง หรือใช้แปลนที่มีขนาดกำกับ เพื่อให้ AI เข้าใจห้องได้ดีขึ้น{count>=4 ? ' หากครบ 4 รูปแล้ว เปลี่ยนภาพมุมซ้ำเป็นมุมใหม่หรือแปลนได้' : ''}</p>
      <p>คะแนนคำนวณจากจำนวนรูป ระบบยังไม่ได้วัดความแม่นยำของผลลัพธ์</p>
      <Link href="/upload" className="inline-flex min-h-9 items-center gap-1 font-semibold text-brand">จัดการภาพอ้างอิง<ArrowUpRight className="size-3" /></Link>
    </div>
  </details>
}
