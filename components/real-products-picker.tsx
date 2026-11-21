'use client'
import {useState} from 'react'
import {styleName} from '@/lib/demo'
import {REAL_CATEGORIES, type RealCategory, type RealProduct, type Verification} from '@/lib/real-catalog'

export const CAT: Record<RealCategory, string> = {seating: 'ที่นั่ง', table: 'โต๊ะ', light: 'ไฟ', textile: 'ผ้า/พรม', accent: 'ของตกแต่ง'}
const BADGE: Record<Verification, {label: string; cls: string}> = {
  photo: {label: 'เปิดรูปแกลเลอรีแล้ว · ตัวเลือกยังไม่ยืนยัน', cls: 'bg-brand-soft text-brand'},
  listing: {label: 'ยืนยันแค่ลิงก์ประกาศ', cls: 'bg-zinc-200 text-ink'},
  gallery_failed: {label: 'ยังเปิดรูปประกาศไม่ได้', cls: 'bg-amber-100 text-amber-900'},
}
const MAX_REAL = 6

// เลือกสินค้าจริงจาก Shopee (snapshot คงที่) ตามสไตล์ ไม่นับในงบ/ความกว้าง ไม่มีราคา/สต็อก ไม่แสดงรูปของร้านค้า
// all = ทุกรายการใน snapshot (รวมที่ยังไม่จัดเข้าสไตล์ของแอป) เลือกข้ามสไตล์ได้ ยังจำกัด MAX_REAL ชิ้น
// fits = คะแนนความเข้ากับห้องของผู้ใช้ 0-3 (Decisions API) ถ้ามี จะเรียงตามคะแนนในแต่ละหมวด
export function RealProductsPicker({all, style, selected, onChange, fits, onRank, ranking = false, rankNote = ''}: {
  all: RealProduct[]; style: string; selected: string[]; onChange: (ids: string[]) => void
  fits?: Record<string, number>; onRank?: () => void; ranking?: boolean; rankNote?: string
}) {
  const [view, setView] = useState<'style' | 'all'>('style')
  const mine = all.filter(p => p.styles.includes(style))
  const byFit = (a: RealProduct, b: RealProduct) => (fits?.[b.id] ?? -1) - (fits?.[a.id] ?? -1)
  const products = (view === 'style' ? mine : all).slice().sort(fits ? byFit : () => 0)
  if (all.length === 0) return null
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : selected.length >= MAX_REAL ? selected : [...selected, id])
  return (
    <section className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4">
      <div>
        <h2 className="text-base font-bold">สินค้าจริงจาก Shopee ในสไตล์นี้</h2>
        <div role="tablist" className="my-2 flex gap-2">
          {([['style', `สไตล์${styleName(style)} (${mine.length})`], ['all', `ทั้งหมด (${all.length})`]] as const).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`min-h-10 rounded-full border px-3 text-xs ${view === v ? 'border-brand-soft bg-brand-soft font-semibold text-brand' : 'border-zinc-200 bg-white text-ink'}`}>{label}</button>
          ))}
        </div>
        {onRank && (
          <button type="button" onClick={onRank} disabled={ranking}
            className="mb-2 min-h-10 rounded-full border border-brand px-3 text-xs font-semibold text-brand disabled:opacity-50">
            {ranking ? 'กำลังดูว่าชิ้นไหนเข้ากับห้องคุณ…' : fits ? 'เรียงตามห้องของคุณแล้ว · เรียงใหม่' : 'เรียงตามความเข้ากับห้องของคุณ'}
          </button>
        )}
        {rankNote && <p role="status" className="mb-2 text-xs text-zinc-500">{rankNote}</p>}
        <p className="text-xs text-zinc-500">เลือกแล้ว {selected.length}/{MAX_REAL} · รายการคัดไว้ล่วงหน้า (snapshot 21 พ.ย. 2026 + รายการเพิ่มจากดัชนี Shopee) ไม่ใช่ข้อมูลสด ราคาและสต็อกยังไม่ยืนยัน จึงไม่รวมในยอดงบหรือความกว้างด้านบน เลือกได้สูงสุด {MAX_REAL} ชิ้นเพื่อใส่ในภาพ AI</p>
      </div>
      {REAL_CATEGORIES.map(cat => {
        const list = products.filter(p => p.category === cat)
        if (list.length === 0) return null
        return (
          <div key={cat} className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-500">{CAT[cat]}</h3>
            <ul className="space-y-2">
              {list.map(p => (
                <li key={p.id} className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-3">
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`เลือก ${p.title}`}
                    disabled={!selected.includes(p.id) && selected.length >= MAX_REAL} className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-medium leading-snug">{p.title}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {fits?.[p.id] !== undefined && <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand">เข้ากับห้อง {fits[p.id].toFixed(1)}/3</span>}
                      <span className={`rounded-full px-2 py-0.5 ${BADGE[p.verification].cls}`}>{BADGE[p.verification].label}</span>
                      {view === 'all' && <span className="text-zinc-500">{p.styles.length ? p.styles.map(styleName).join(' · ') : 'ยังไม่จัดเข้าสไตล์ของแอป'}</span>}
                      {p.dimensions && <span className="text-zinc-500">ขนาดตามประกาศ {p.dimensions} ซม. (ตัวเลือกยังไม่ยืนยัน)</span>}
                    </span>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-xs font-semibold text-brand">เปิดประกาศใน Shopee ›</a>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
