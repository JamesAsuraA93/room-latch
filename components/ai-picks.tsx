'use client'
import {useCallback, useEffect, useRef, useState} from 'react'
import {ArrowUpRight, RefreshCw, Sparkles} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {CAT} from '@/components/real-products-picker'
import {baht} from '@/lib/copy'
import type {Plan} from '@/lib/demo'
import type {RealCategory} from '@/lib/real-catalog'
import {RECOMMEND_KEY} from '@/lib/storage-keys'

export type AiItem = {id: string; title: string; category: string; price: number; rating: number | null; reason: string; url: string | null}
type Recommendation = {source: 'ai' | 'rules'; items: AiItem[]; total: number; budget: number; summary: string}

// Step 5: real Shopee products for this room within the budget, chosen on the server (POST /api/recommend).
// One answer per plan is kept in this tab, so revisiting the page costs no new model call.
export function AiPicks({plan, onUse}: {plan: Plan; onUse: (items: AiItem[]) => void}) {
  const key = JSON.stringify({styleId: plan.style, roomType: plan.roomType, budget: plan.budget, width: plan.width, need: plan.need ?? ''})
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const current = useRef(key) // the plan on screen now: an answer for an older plan is dropped
  current.current = key

  const load = useCallback(async (fresh: boolean) => {
    if (!fresh) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(RECOMMEND_KEY) || 'null')
        if (saved?.key === key && Array.isArray(saved.rec?.items)) { setRec(saved.rec); return }
      } catch {}
    }
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/recommend', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: key})
      if (!r.ok) throw new Error()
      const next = await r.json() as Recommendation
      if (current.current !== key) return
      setRec(next)
      try { sessionStorage.setItem(RECOMMEND_KEY, JSON.stringify({key, rec: next})) } catch {}
    } catch { if (current.current === key) setError('เลือกสินค้าไม่สำเร็จ กรุณาลองใหม่') }
    finally { if (current.current === key) setLoading(false) }
  }, [key])

  useEffect(() => { void load(false) }, [load])

  return (
    <section aria-label="สินค้าจริงที่ AI เลือกให้" aria-busy={loading} className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="rl-section-label">PICKED FOR YOUR ROOM</p>
          <h2 className="mt-2 text-lg font-semibold">สินค้าจริงจาก Shopee ที่เลือกให้ตามงบ</h2>
        </div>
        {rec && rec.items.length > 0 && (
          <p className="rounded-full bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">รวม {baht(rec.total)} / งบ {baht(rec.budget)}</p>
        )}
      </div>

      {loading && <p role="status" className="flex items-center gap-2 text-sm text-zinc-500"><Sparkles className="size-4 animate-pulse text-brand motion-reduce:animate-none" />กำลังเลือกสินค้าที่เข้ากับห้องและงบ…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {rec && !loading && (
        rec.items.length === 0
          ? <p className="text-sm text-zinc-500">ยังไม่มีสินค้าในสไตล์นี้ที่ราคาไม่เกินงบ ลองเพิ่มงบหรือเปลี่ยนสไตล์</p>
          : <>
            <p className="text-xs leading-6 text-zinc-500">
              {rec.source === 'ai' ? 'AI เลือกจากสินค้าที่ได้คะแนนรีวิวดีในสไตล์นี้ ' : 'เลือกตามคะแนนรีวิวสูงสุดของแต่ละหมวดที่ยังอยู่ในงบ (ยังไม่ได้ใช้ AI) '}
              {rec.summary}
            </p>
            <ul className="space-y-2">
              {rec.items.map(p => (
                <li key={p.id} className="rounded-2xl border border-[#ece6df] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] text-zinc-500">{CAT[p.category as RealCategory] ?? p.category}{p.rating ? ` · ${p.rating}★` : ''}</p>
                      <p className="mt-1 line-clamp-2 text-sm">{p.title}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">{baht(p.price)}</p>
                  </div>
                  {p.reason && <p className="mt-2 text-xs leading-5 text-zinc-600">{p.reason}</p>}
                  {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1 text-xs text-brand">เปิดประกาศใน Shopee<ArrowUpRight className="size-3.5" /></a>}
                </li>
              ))}
            </ul>
            <p className="text-[11px] leading-5 text-zinc-500">ราคาตามวันที่ระบบเก็บข้อมูล ไม่รวมค่าส่ง อาจเปลี่ยนแล้ว ดูราคา สต็อก และตัวเลือกจริงในประกาศ</p>
            <Button className="w-full" onClick={() => onUse(rec.items)}><Sparkles className="size-4" />ใช้ชุดนี้สร้างภาพในห้องของฉัน</Button>
          </>
      )}
      {!loading && <Button variant="ghost" className="w-full" onClick={() => void load(true)}><RefreshCw className="size-4" />เลือกชุดใหม่</Button>}
    </section>
  )
}
