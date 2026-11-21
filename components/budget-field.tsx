'use client'
import {useId} from 'react'
import {Slider} from '@/components/ui/slider'
import {BUDGET_PRESETS} from '@/lib/demo'

export function BudgetField({value, onChange}: {value: string; onChange: (value: string) => void}) {
  const id = useId()
  const amount = Number(value) || 0
  // Keep the normal furniture range easy to drag; larger typed budgets expand the scale.
  const ceiling = Math.min(1_000_000, Math.max(50_000, Math.ceil(amount / 50_000) * 50_000))
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label htmlFor={id} className="text-base font-semibold">งบสูงสุดสำหรับสินค้า</label>
      <div className="flex items-center gap-2"><input id={id} inputMode="numeric" pattern="[0-9]*" value={value} onChange={e => onChange(e.target.value.replace(/\D/g, ''))} aria-describedby={`${id}-help`} className="min-h-12 w-36 rounded-xl border border-zinc-300 bg-paper px-3 text-right text-2xl font-semibold text-brand-dark focus-visible:outline-2 focus-visible:outline-brand" /><span className="text-sm text-zinc-700">บาท</span></div>
    </div>
    <Slider aria-label="ปรับงบสูงสุดสำหรับสินค้า" value={[Math.max(100, Math.min(ceiling, amount))]} min={100} max={ceiling} step={100} onValueChange={([next]) => onChange(String(next))} className="h-11" />
    <div className="flex justify-between text-sm text-zinc-600"><span>฿100</span><span>฿{ceiling.toLocaleString('th-TH')}</span></div>
    <p id={`${id}-help`} className="text-sm text-zinc-700">ลากเพื่อปรับงบ หรือพิมพ์จำนวนเงิน</p>
    <div className="flex flex-wrap gap-2">{BUDGET_PRESETS.map(n => <button key={n} type="button" aria-pressed={amount === n} onClick={() => onChange(String(n))} className={`min-h-11 rounded-xl border px-4 text-sm ${amount === n ? 'border-brand bg-brand-soft font-semibold text-brand-dark' : 'border-zinc-200 text-zinc-700'}`}>฿{n.toLocaleString('th-TH')}</button>)}</div>
  </div>
}
