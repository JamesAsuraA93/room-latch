'use client'
import {useEffect, useRef, useState} from 'react'
import {X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {baht, fill, t} from '@/lib/copy'
import {SHOPEE_SEARCH, demoProductImage, type Pos} from '@/lib/demo'
import type {ExactListing} from '@/lib/listings'
import type {Product} from '@/lib/plan'

// ต้องตรงกับ defaultPos ใน placement.tsx เพื่อให้โหมดดูกับโหมดแก้ไขวางของที่เดียวกัน
export const defaultPos = (i: number, n: number): Pos => ({x: n > 1 ? 4 + (i * 68) / (n - 1) : 36, y: 46 + (i % 2) * 5, w: 26})
export const EXACT_POS: Pos = {x: 34, y: 4, w: 34} // ประกาศจริงวางมุมบนขวา (โต๊ะ/ริมหน้าต่าง) ไม่ทับชุดจาก catalog
const HIGHLIGHT_MS = 4500

type Shown = {id: string; name: string; image: string; kind: 'exact' | 'custom' | 'user' | 'demo'; price: string | null; link: {href: string; label: string} | null; matchedAt?: string; cutout?: string; hasPhoto?: boolean}

/**
 * ลิงก์ของแต่ละชิ้น: ประกาศจริง > ลิงก์ที่ผู้ใช้วางเอง > ค้นหา (เฉพาะชิ้นที่เป็นภาพ demo)
 * ผู้ใช้ใส่รูปเองแต่ไม่มีลิงก์ที่ยืนยัน = ไม่ใส่ลิงก์ (ไม่เดา)
 */
function shownItems(items: Product[], exacts: ExactListing[], photos: Record<string, string>): Shown[] {
  const fromCatalog = items.map((p): Shown => {
    const custom = p.id.startsWith('custom-')
    const user = !!photos[p.id]
    return {
      id: p.id, name: p.name, image: photos[p.id] ?? demoProductImage(p.name),
      kind: custom ? 'custom' : user ? 'user' : 'demo',
      price: custom ? baht(p.priceMax) : `${t.approx} ${baht(p.priceMin)}–${baht(p.priceMax)}${p.deeplink ? ` · ${t.samplePriceNote}` : ''}`,
      link: custom ? {href: p.deeplink, label: t.openYourListing} : p.deeplink ? {href: p.deeplink, label: t.openExact} : user ? null : {href: `${SHOPEE_SEARCH}${encodeURIComponent(p.keyword)}`, label: t.searchKeyword},
    }
  })
  const fromListings = exacts.map((l): Shown => ({id: l.id, name: l.title, image: l.image ?? demoProductImage(l.title), hasPhoto: !!l.image, kind: 'exact', price: null, link: {href: l.url, label: t.openExact}, matchedAt: l.matchedAt, cutout: l.image ? l.cutout : undefined}))
  return [...fromCatalog, ...fromListings] // ประกาศจริงวาดทีหลัง อยู่ชั้นบนสุด
}

// กรอบเดียว สลับก่อน/หลังด้วยปุ่มหรือปัด "หลัง" คือรูปห้องเดิม + รูปสินค้าที่จัดวาง ไม่มีหมุดหรือกรอบตอนปกติ
export function RoomCompare({roomImage, items, exacts, pos, photos, flash}: {roomImage: string; items: Product[]; exacts: ExactListing[]; pos: Record<string, Pos>; photos: Record<string, string>; flash?: {ids: string[]; key: number}}) {
  const [view, setView] = useState<'before' | 'after'>('after')
  // 'all' = ปุ่มดูของที่เพิ่ม, string[] = เฉพาะชิ้นที่เพิ่งถูกเปลี่ยนตอนปรับงบ
  const [highlight, setHighlight] = useState<'all' | string[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const swipe = useRef<number | null>(null)

  useEffect(() => {
    if (!flash?.ids.length) return
    setView('after'); setOpen(null); setHighlight(flash.ids)
  }, [flash])

  useEffect(() => {
    if (!highlight) return
    const timer = setTimeout(() => setHighlight(null), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [highlight])

  const shown = shownItems(items, exacts, photos)
  const posOf = (s: Shown) => pos[s.id] ?? (s.kind === 'exact' ? EXACT_POS : defaultPos(items.findIndex(p => p.id === s.id), items.length))
  const card = shown.find(s => s.id === open)

  return (
    <section className="space-y-3">
      <div role="group" aria-label={t.compareFrame} className="grid grid-cols-2 rounded-full bg-zinc-100 p-1">
        {(['before', 'after'] as const).map(v => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); setOpen(null) }}
            className={`min-h-11 rounded-full text-sm font-semibold ${view === v ? 'bg-white text-ink shadow-sm' : 'text-zinc-500'}`}>
            {v === 'before' ? t.viewBefore : t.viewAfter}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-zinc-100 select-none" aria-label={t.compareFrame}
        onPointerDown={e => { swipe.current = e.clientX }}
        onPointerUp={e => {
          if (swipe.current === null) return
          const dx = e.clientX - swipe.current
          swipe.current = null
          if (Math.abs(dx) > 50) { setView(dx < 0 ? 'after' : 'before'); setOpen(null) }
        }}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(null) }}>
        <img src={roomImage} alt={view === 'before' ? t.before : t.after} className="block h-auto w-full" draggable={false} />
        {view === 'after' && shown.map(s => {
          const ps = posOf(s)
          return (
            <button key={s.id} type="button" aria-label={s.name} aria-expanded={open === s.id} data-kind={s.kind}
              onClick={() => setOpen(s.id)} onFocus={() => setOpen(s.id)}
              onPointerEnter={e => { if (e.pointerType === 'mouse') setOpen(s.id) }}
              style={{left: `${ps.x}%`, top: `${ps.y}%`, width: `${ps.w}%`}}
              className={`rl-reveal absolute rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-white ${highlight === 'all' || highlight?.includes(s.id) ? 'rl-highlight' : ''}`}>
              {s.kind === 'exact' && s.hasPhoto
                // รูปประกาศเป็นภาพบรรยากาศ ไม่ใช่ภาพตัดพื้น ครอปให้เห็นตัวโคม รูปเต็มอยู่ในการ์ด
                ? s.cutout
                  // ตัดเฉพาะตัวโคมด้วย clip-path บนรูปเต็ม เงาใส่ที่ wrapper เพราะ drop-shadow ต้องอยู่นอก element ที่ถูก clip
                  ? <span className="block drop-shadow-[0_6px_8px_rgba(46,38,34,0.35)]"><img src={s.image} alt="" draggable={false} style={{clipPath: s.cutout}} className="pointer-events-none block aspect-square w-full" /></span>
                  : <img src={s.image} alt="" draggable={false} className="pointer-events-none block aspect-[3/4] w-full rounded-xl object-cover object-left shadow-[0_8px_16px_rgba(46,38,34,0.3)]" />
                : <img src={s.image} alt="" draggable={false} className={`pointer-events-none block h-auto w-full drop-shadow-[0_6px_8px_rgba(46,38,34,0.25)] ${s.kind === 'user' || s.kind === 'custom' ? 'mix-blend-multiply' : ''}`} />}
            </button>
          )
        })}

        {view === 'after' && card && (
          <div role="dialog" aria-label={card.name} className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
            <div className="flex items-start gap-2">
              {card.kind === 'exact' && card.hasPhoto && <img src={card.image} alt={card.name} className="size-16 shrink-0 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{card.name}{card.kind === 'exact' && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[10px] text-white">{t.exactTag}</span>}</p>
                {card.kind === 'exact' ? (
                  <>
                    <p className="text-xs text-zinc-600">{fill(card.hasPhoto ? t.exactPhotoLink : t.exactLinkOnly, {d: card.matchedAt ?? ''})}</p>
                    <p className="text-xs text-zinc-500">{t.exactUnknown}</p>
                  </>
                ) : (
                  <p className="text-xs text-zinc-500">{card.price} · {card.kind === 'user' || card.kind === 'custom' ? t.userPhoto : t.demoPhoto}</p>
                )}
              </div>
              <button type="button" aria-label={t.close} onClick={() => setOpen(null)} className="flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"><X className="size-5" /></button>
            </div>
            {card.link
              ? <Button asChild className="mt-2 w-full"><a href={card.link.href} target="_blank" rel="noopener noreferrer">{card.link.label} ›</a></Button>
              : <p className="mt-2 text-xs text-zinc-600">{t.noVerifiedLink}</p>}
          </div>
        )}
      </div>

      <Button variant="outline" className="w-full" onClick={() => { setView('after'); setOpen(null); setHighlight('all') }}>{t.showAdded}</Button>
      <p className="text-xs text-zinc-500">{t.tapItem}</p>
      {shown.some(s => s.kind === 'demo') && <p className="text-xs text-zinc-500">{t.someDemo}</p>}
    </section>
  )
}
