import {baht} from '@/lib/copy'
import {furnitureTotal, type Furniture} from '@/lib/furniture'

export function BudgetSummary({items, budget}: {items: Furniture[]; budget: number}) {
  const {total, unknown, estimated} = furnitureTotal(items)
  const over = total > budget
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 text-base text-zinc-800"><span>งบที่ตั้งไว้</span><strong className="tabular-nums">{baht(budget)}</strong></div>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-base font-medium text-zinc-700">ยอดรวมอ้างอิง</span><strong className="text-3xl tabular-nums text-brand-dark">{baht(total)}</strong></div>
    <div role="status" className={`rounded-xl border p-4 ${over ? 'border-red-200 bg-red-50 text-red-900' : unknown ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}>
      <p className="text-base font-semibold">{over ? 'เกินงบประมาณ' : unknown ? 'งบคงเหลือก่อนรวมรายการไม่ทราบราคา' : 'งบประมาณคงเหลือ'}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{baht(Math.abs(budget - total))}</p>
      {unknown > 0 && <p className="mt-2 text-sm font-medium">ยังไม่รวม {unknown} ชิ้นที่ไม่ทราบราคา</p>}
    </div>
    <p className="text-sm leading-6 text-zinc-700">{estimated ? 'มีราคาประมาณรวมอยู่ด้วย · ' : ''}ราคาอ้างอิงจากแคตตาล็อก ตรวจราคา ตัวเลือก และขนาดก่อนซื้อ</p>
  </div>
}
