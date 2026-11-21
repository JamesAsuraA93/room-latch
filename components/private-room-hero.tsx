'use client'
import {useEffect, useRef, useState} from 'react'
import {Button} from '@/components/ui/button'
import {ACCEPT, getPair, loadPic, setPic, usePrivatePair} from '@/lib/private-pair'
import type {LocalListing} from '@/lib/local-demo'

// ตัวอย่างห้องจริงบน Feed (เฉพาะเครื่อง): Before = รูปห้องจริงของเจ้าของ, After = ภาพจำลอง AI จากมุมเดิม
// ผู้ใช้เลือกไฟล์เองจากเครื่อง ภาพอยู่ในหน่วยความจำเท่านั้น ไม่มี fetch ไม่เขียน storage
export function PrivateRoomHero({listings, example}: {listings: LocalListing[]; example?: {before: string; after: string} | null}) {
  const {before, after} = usePrivatePair()
  // ตัวอย่างห้องจริงของเจ้าของ (ไฟล์ส่วนตัวในเครื่อง เสิร์ฟผ่าน route ที่ล็อกไว้) โหลดให้เลยถ้ายังไม่ได้เลือกไฟล์เอง
  useEffect(() => {
    if (!example) return
    for (const slot of ['before', 'after'] as const) {
      if (getPair()[slot]) continue
      const img = new Image()
      img.onload = () => { if (!getPair()[slot]) setPic(slot, {url: example[slot], w: img.naturalWidth, h: img.naturalHeight, name: slot === 'before' ? 'ห้องจริงของเจ้าของ' : 'ภาพจำลอง AI (Codex)'}) }
      img.src = example[slot]
    }
  }, [example])
  const [view, setView] = useState<'before' | 'after'>('after')
  const [open, setOpen] = useState<string | null>(listings[0]?.id ?? null)
  const [error, setError] = useState('')
  const swipe = useRef<number | null>(null)
  const base = before ?? after
  const ratioOff = before && after ? Math.abs(before.w / before.h - after.w / after.h) / (before.w / before.h) > 0.02 : false
  const shown = view === 'before' ? before : after
  const card = listings.find(l => l.id === open)

  async function pick(slot: 'before' | 'after', file?: File) {
    if (!file) return
    setError('')
    try { setPic(slot, await loadPic(file)) } catch (e) { setError((e as Error).message) }
  }

  return (
    <section className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">ห้องจริง: ก่อน / หลัง</h2>
        <span className="text-[11px] font-semibold text-brand">เฉพาะเครื่องนี้</span>
      </div>

      {(!before || !after) && (
        <div className="space-y-2 rounded-2xl bg-brand-soft p-3 text-xs">
          <p>เลือกรูปคู่จากเครื่องนี้: <b>Before</b> = รูปห้องจริง (เช่น 01-Before-Original.jpg) และ <b>After</b> = ภาพจำลอง AI จากมุมเดียวกัน (เช่น 02-After-AI-Preview.png) ไฟล์ไม่ถูกบันทึกหรืออัปโหลด รีเฟรชแล้วต้องเลือกใหม่</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(['before', 'after'] as const).map(slot => {
          const pic = slot === 'before' ? before : after
          return (
            <label key={slot} className="block rounded-2xl border border-dashed border-zinc-300 p-2 text-xs">
              <span className="block font-semibold">{slot === 'before' ? 'Before (ห้องจริง)' : 'After (ภาพจำลอง AI)'}</span>
              <span className="block truncate text-zinc-500">{pic ? `${pic.name} · ${pic.w}×${pic.h}` : 'jpg / png / webp'}</span>
              <input type="file" accept={ACCEPT.join(',')} aria-label={slot === 'before' ? 'เลือกรูป Before' : 'เลือกรูป After'}
                className="mt-1 block w-full text-[11px] file:mr-2 file:min-h-9 file:rounded-xl file:border-0 file:bg-brand-soft file:px-3 file:text-brand"
                onChange={e => { void pick(slot, e.target.files?.[0]); e.target.value = '' }} />
            </label>
          )
        })}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {ratioOff && <p className="text-xs text-amber-800">สัดส่วนสองรูปไม่เท่ากัน กรอบใช้สัดส่วนรูป Before และครอปรูป After ให้เต็มกรอบ</p>}

      {base && (
        <>
          <div role="group" aria-label="เปรียบเทียบก่อนและหลัง" className="grid grid-cols-2 gap-2">
            {(['before', 'after'] as const).map(v => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
                className={`min-h-11 rounded-full border text-sm font-semibold ${view === v ? 'border-brand bg-brand text-white' : 'border-zinc-200 bg-white text-ink'}`}>
                {v === 'before' ? 'ก่อน' : 'หลัง'}
              </button>
            ))}
          </div>
          <div className="relative w-full select-none overflow-hidden rounded-2xl bg-zinc-100"
            style={{aspectRatio: `${base.w} / ${base.h}`}}
            onPointerDown={e => { swipe.current = e.clientX }}
            onPointerUp={e => { if (swipe.current === null) return; const dx = e.clientX - swipe.current; swipe.current = null; if (Math.abs(dx) > 50) setView(dx < 0 ? 'after' : 'before') }}>
            {shown
              ? <img src={shown.url} alt={view === 'before' ? 'ห้องจริงก่อนจัด' : 'ภาพจำลอง AI หลังจัด'} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
              : <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">ยังไม่ได้เลือกรูป {view === 'before' ? 'Before' : 'After'}</div>}
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/80 px-3 py-1 text-[11px] text-white">
              {view === 'before' ? 'ห้องจริง' : 'ภาพจำลอง AI ไม่ใช่ภาพถ่ายจริง'}
            </span>
            {view === 'after' && after && listings.map((l, i) => (
              <button key={l.id} type="button" aria-label={l.title} aria-pressed={open === l.id} onClick={() => setOpen(l.id)}
                style={{left: `${l.x}%`, top: `${l.y}%`}}
                className={`absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white shadow ${open === l.id ? 'bg-brand ring-4 ring-accent/60' : 'bg-brand/80'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        </>
      )}

      {/* การ์ดรายละเอียดอยู่นอกรูปเสมอ */}
      {card && (
        <div className="space-y-2 rounded-2xl border border-zinc-200 p-3">
          <div className="flex gap-2 overflow-x-auto">
            {listings.map((l, i) => (
              <button key={l.id} type="button" aria-pressed={open === l.id} onClick={() => setOpen(l.id)}
                className={`min-h-10 shrink-0 rounded-full border px-3 text-xs ${open === l.id ? 'border-brand-soft bg-brand-soft font-semibold text-brand' : 'border-zinc-200 bg-white'}`}>
                {i + 1}. {l.title}
              </button>
            ))}
          </div>
          <p className="text-sm font-semibold">{card.title} <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-[10px] text-white">ประกาศจริง</span></p>
          <p className="text-xs text-zinc-600">{card.note} · ไม่มีราคาสดหรือสต็อก ดูในประกาศ</p>
          <p className="text-xs text-zinc-600">ภาพนี้เป็นภาพจำลอง ไม่ได้ยืนยันขนาดจริง ควรวัดพื้นที่ก่อนซื้อ</p>
          <Button asChild className="w-full"><a href={card.url} target="_blank" rel="noopener noreferrer">เปิดประกาศใน Shopee ›</a></Button>
        </div>
      )}
    </section>
  )
}
