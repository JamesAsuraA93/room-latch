import Link from 'next/link'
import {Images, ArrowUpRight} from 'lucide-react'
export function ReferenceFeedback({count}: {count: number}) {
  return <details className="rl-disclosure">
    <summary className="list-none">
      <span className="flex items-center gap-3">
        <Images className="size-5 text-brand" />
        <span className="flex-1">
          ภาพอ้างอิง {count}/4 รูป
        </span>
        <span className="text-lg text-brand">+</span>
      </span>
    </summary>
    <div className="space-y-3 text-sm leading-6 text-zinc-600">
      <p>เพิ่มภาพต่างมุมหรือแปลน เพื่อให้เห็นพื้นที่ ประตู และหน้าต่างชัดขึ้น</p>
      <Link href="/upload" className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand">จัดการรูปห้อง<ArrowUpRight className="size-4" /></Link>
    </div>
  </details>
}
