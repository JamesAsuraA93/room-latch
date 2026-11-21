'use client'
import {useRef, useState} from 'react'
import {demoProductImage, type Pos} from '@/lib/demo'
import {EXACT_POS} from '@/components/room-compare'
import {resizeRoomImage} from '@/lib/image'
import {t} from '@/lib/copy'
import {Button} from '@/components/ui/button'
import {Slider} from '@/components/ui/slider'

type Value = {pos: Record<string, Pos>; photos: Record<string, string>}
// image = รูปประกาศจริง (ไม่ให้เปลี่ยนรูป) ไม่มี = ชิ้นจาก catalog
type Item = {id: string; name: string; image?: string}
const DEMO_BADGE = 'demo'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const defaultPos = (i: number, n: number): Pos => ({x: n > 1 ? 4 + (i * 68) / (n - 1) : 36, y: 46 + (i % 2) * 5, w: 26})

export function Placement({roomImage, items, value, onChange}: {roomImage: string; items: Item[]; value: Value; onChange: (v: Value) => void}) {
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{id: string; px: number; py: number; start: Pos} | null>(null)
  const [selected, setSelected] = useState<string | null>(items[0]?.id ?? null)
  const catalogItems = items.filter(p => !p.image)
  const posOf = (id: string) => value.pos[id] ?? (items.find(p => p.id === id)?.image ? EXACT_POS : defaultPos(catalogItems.findIndex(p => p.id === id), catalogItems.length))
  const setPos = (id: string, p: Pos) => onChange({...value, pos: {...value.pos, [id]: p}})
  const sel = items.find(p => p.id === selected)

  const onDown = (e: React.PointerEvent, id: string) => {
    setSelected(id)
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {id, px: e.clientX, py: e.clientY, start: posOf(id)}
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, r = frame.current?.getBoundingClientRect()
    if (!d || !r) return
    const {start} = d
    setPos(d.id, {...start, x: clamp(start.x + ((e.clientX - d.px) / r.width) * 100, 0, 100 - start.w), y: clamp(start.y + ((e.clientY - d.py) / r.height) * 100, 0, 95)})
  }
  // reset = position/size only; the user's listing photo is kept
  const without = (rec: Record<string, Pos>, id: string) => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== id))

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try { onChange({...value, photos: {...value.photos, [id]: await resizeRoomImage(file, 600)}}) } catch { /* not an image: keep current photo */ }
  }

  return (
    <div className="mx-auto w-full max-w-[480px] space-y-3">
      <div>
        <h2 className="text-lg font-bold text-ink">{t.place}</h2>
        <p className="text-xs text-zinc-500">{t.placeHint}</p>
      </div>
      <div ref={frame} className="relative overflow-hidden rounded-3xl bg-zinc-100 select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={roomImage} alt="" className="block h-auto w-full" draggable={false} />
        {items.map(p => {
          const pos = posOf(p.id), photo = value.photos[p.id] ?? p.image
          return (
            <button key={p.id} type="button" aria-label={p.name} aria-pressed={p.id === selected}
              onPointerDown={e => onDown(e, p.id)} onPointerMove={onMove} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
              style={{left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.w}%`, touchAction: 'none'}}
              className={`absolute cursor-grab rounded-xl active:cursor-grabbing ${p.id === selected ? 'ring-4 ring-brand' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo ?? demoProductImage(p.name)} alt="" draggable={false} className={`pointer-events-none block w-full rounded-xl ${p.image ? 'aspect-[3/4] object-cover object-left' : 'h-auto'}`} />
              {!photo && <span className="absolute left-1 top-1 rounded-full bg-ink/70 px-1.5 text-[10px] text-white" title={t.demoPhoto}>{DEMO_BADGE}</span>}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label={t.selectItem}>
        {items.map(p => (
          <button key={p.id} type="button" onClick={() => setSelected(p.id)} aria-pressed={p.id === selected}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${p.id === selected ? 'border-brand bg-brand-soft text-brand-dark' : 'border-zinc-200 bg-white text-ink'}`}>
            {p.name}
          </button>
        ))}
      </div>

      {sel ? (
        <div className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4">
          <p className="text-sm font-semibold text-ink">{sel.name}</p>
          <p className="text-xs text-zinc-500">{sel.image ? t.exactTag : value.photos[sel.id] ? t.userPhoto : t.demoPhoto}</p>
          <div className="space-y-1">
            <span className="text-sm text-zinc-600">{t.size}</span>
            <Slider aria-label={t.size} min={10} max={80} step={1} value={[posOf(sel.id).w]} className="h-11"
              onValueChange={([w]) => { const p = posOf(sel.id); setPos(sel.id, {...p, w, x: clamp(p.x, 0, 100 - w)}) }} />
          </div>
          {!sel.image && <label className="block space-y-1">
            <span className="block text-sm font-semibold text-ink">{t.productPhoto}</span>
            <span className="block text-xs text-zinc-500">{t.productPhotoHint}</span>
            <input type="file" accept="image/*" onChange={e => onPhoto(e, sel.id)}
              className="block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-2xl file:border-0 file:bg-brand-soft file:px-4 file:text-brand-dark" />
          </label>}
          <Button variant="outline" className="w-full" onClick={() => onChange({...value, pos: without(value.pos, sel.id)})}>
            {t.resetOne}
          </Button>
        </div>
      ) : <p className="text-xs text-zinc-500">{t.selectItem}</p>}

      <Button variant="ghost" className="w-full" onClick={() => onChange({...value, pos: {}})}>{t.resetAll}</Button>
    </div>
  )
}
