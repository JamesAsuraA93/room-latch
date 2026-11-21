'use client'
import {useId} from 'react'

// ช่องตัวเลข + ปุ่มค่าลัด ใช้ทั้งหน้าตั้งค่าและหน้าผลลัพธ์
export function NumberField({label, hint, value, onChange, presets}: {label: string; hint?: string; value: string; onChange: (v: string) => void; presets: number[]}) {
  const id = useId()
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      <input id={id} inputMode="numeric" pattern="[0-9]*" value={value} onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        className="min-h-12 w-full rounded-2xl border border-zinc-200 bg-paper px-4 text-2xl font-semibold outline-none focus:border-brand" />
      <div className="flex gap-2">
        {presets.map(n => (
          <button key={n} type="button" onClick={() => onChange(String(n))}
            className={`min-h-9 rounded-full border px-3 text-xs ${value === String(n) ? 'border-brand bg-brand-soft text-brand-dark' : 'border-zinc-200 text-zinc-600'}`}>
            {n.toLocaleString('th-TH')}
          </button>
        ))}
      </div>
    </div>
  )
}
