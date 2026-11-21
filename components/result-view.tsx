'use client'
import {useEffect, useMemo, useState} from 'react'
import {PageHeader} from '@/components/page-header'
import {LiveRenderPanel} from '@/components/live-render-panel'
import type {Provider} from '@/lib/live-render-core'
import {RealProductsPicker} from '@/components/real-products-picker'
import type {RealProduct} from '@/lib/real-catalog'
import Link from 'next/link'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {NumberField} from '@/components/number-field'
import {RemixBanner} from '@/components/remix-banner'
import {ShareDialog} from '@/components/share-dialog'
import {Placement} from '@/components/placement'
import {ListingForm} from '@/components/listing-form'
import {RoomCompare} from '@/components/room-compare'
import {exactFor} from '@/lib/listings'
import {baht, fill, t} from '@/lib/copy'
import {BEFORE, DEFAULT_PLAN, EMPTY_PLACEMENT, ROOM_IMAGE_KEY, SHOPEE_SEARCH, readDrafts, RENDER_KEY, readJson, readPlacement, readPlan, roomName, savePlan, startDemoSession, styleName, writeDrafts, writePlacement, type Placement as PlacementState, type Plan} from '@/lib/demo'
import {fits, minimalSwap, noFitHint, pickSet, spec, type Change, type Product} from '@/lib/plan'
import {Lock} from 'lucide-react'

const productUrl = (p: Product) => p.deeplink || `${SHOPEE_SEARCH}${encodeURIComponent(p.keyword)}`
const isLocked = (p: Product) => p.id.startsWith('custom-')

// หน้าหลักของ flow: ก่อน/หลังในกรอบเดียว หลัง = รูปห้องเดิม + รูปสินค้าที่จัดวาง (product first) ลาก/ย่อขยายอยู่ในโหมดแก้ไข
export function ResultView({products, live = null, real = []}: {products: Product[]; live?: Provider | null; real?: RealProduct[]}) {
  // สินค้าจริงที่เลือก (แยกจากชุดที่คิดงบ) อยู่ในหน่วยความจำของหน้านี้เท่านั้น
  const [realIds, setRealIds] = useState<string[]>([])
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN)
  const [before, setBefore] = useState(BEFORE)
  const [sample, setSample] = useState(true)
  const [placement, setPlacement] = useState<PlacementState>(EMPTY_PLACEMENT)
  const [editing, setEditing] = useState(false)
  const [budget, setBudget] = useState('')
  const [width, setWidth] = useState('')
  const [changes, setChanges] = useState<Change[] | null>(null)
  const [note, setNote] = useState('')
  const [render, setRender] = useState<{ok: boolean; provider?: string} | null>(null)

  useEffect(() => {
    const p = readPlan()
    setPlan(p); setBudget(String(p.budget)); setWidth(String(p.width))
    setPlacement(readPlacement())
    setRender(readJson<{ok: boolean; provider?: string} | null>('session', RENDER_KEY, null))
    try {
      const saved = sessionStorage.getItem(ROOM_IMAGE_KEY)
      setBefore(saved || BEFORE)
      // รูปห้องจริงจาก Feed อยู่ในหน่วยความจำ (blob:) รีเฟรชแล้วหาย จึงกลับไปใช้รูปตัวอย่าง
      if (saved?.startsWith('blob:')) { const img = new Image(); img.onerror = () => setBefore(BEFORE); img.src = saved }
      setSample(!saved || !!p.sample)
    } catch {}
  }, [])

  // ชุดปัจจุบัน: ถ้าเคยปรับงบ/ขนาดแล้วใช้ชุดที่เก็บไว้ (เปลี่ยนเฉพาะชิ้นที่จำเป็น) ไม่งั้นเลือกชุดแรกจาก engine
  const result = useMemo(() => {
    const ids = placement.set
    const items = ids?.map(id => [...placement.locked, ...products].find(p => p.id === id)).filter((p): p is Product => !!p)
    if (!items || items.length !== ids!.length) return pickSet(products, plan, placement.locked)
    const f = fits(items, plan)
    return {items, total: f.total, floorWidth: f.floorWidth, lockedOk: fits(placement.locked, plan).ok}
  }, [products, plan, placement.locked, placement.set])
  const [flash, setFlash] = useState({ids: [] as string[], key: 0})
  const [totals, setTotals] = useState<{from: number; to: number} | null>(null)
  const hint = useMemo(() => noFitHint(products, plan), [products, plan])
  // ประกาศจริง: รูป+ลิงก์ตรงประกาศ แต่ไม่รู้ราคา/ขนาด จึงอยู่นอก engine งบ/ความกว้าง
  const exacts = useMemo(() => exactFor(plan.roomType), [plan.roomType])

  function updatePlacement(next: PlacementState) {
    setPlacement(next)
    if (!writePlacement(next)) setNote(t.storageFull)
  }

  function apply(next: Partial<Plan>) {
    const merged = {...plan, ...next}
    if (!(merged.budget > 0 && merged.width > 0)) return
    swap(merged, placement.locked)
    setPlan(merged); setBudget(String(merged.budget)); setWidth(String(merged.width))
    savePlan(merged)
  }

  /** เปลี่ยนเฉพาะชิ้นที่จำเป็น ของที่ล็อกไม่ถูกปลด ชิ้นที่มาแทนวางที่มุมเดิมของชิ้นเก่า แล้วเรืองขอบชิ้นที่เปลี่ยน */
  function swap(input: Plan, locked: Product[], photos = placement.photos) {
    const prev = [...locked.filter(l => !result.items.some(p => p.id === l.id)), ...result.items]
    // ชุดว่าง (เคย no-fit) ไม่มีอะไรให้ "เปลี่ยนน้อยที่สุด" จึงเลือกชุดใหม่จาก engine
    const r = prev.some(p => !locked.some(l => l.id === p.id))
      ? minimalSwap(products, prev, input, locked)
      : {...pickSet(products, input, locked), changes: [] as Change[]}
    const pos = {...placement.pos}
    for (const c of r.changes) if (c.kind === 'replaced' && c.from && pos[c.from.id]) pos[c.item.id] = pos[c.from.id]
    setChanges(r.changes)
    setTotals(r.changes.length ? {from: fits(result.items, input).total, to: r.total} : null)
    setFlash({ids: r.changes.filter(c => c.kind === 'replaced').map(c => c.item.id), key: Date.now()})
    updatePlacement({...placement, pos, photos, locked, set: r.items.map(p => p.id)})
  }

  function setLocked(locked: Product[], photos = placement.photos) {
    swap(plan, locked, photos)
  }

  /** ซ้อมเดโมใหม่: ห้องตัวอย่าง + ค่าเริ่มต้น ไม่แตะของที่เซฟ/ไลก์/draft */
  function resetDemo() {
    startDemoSession()
    setPlan(readPlan()); setBudget(String(readPlan().budget)); setWidth(String(readPlan().width))
    setPlacement(readPlacement()); setBefore(BEFORE); setSample(true)
    setChanges(null); setTotals(null); setEditing(false); setRender(null); setNote('')
    window.scrollTo({top: 0})
  }

  function saveDraft() {
    const draft = {id: `d-${Date.now()}`, savedAt: Date.now(), plan, items: result.items.map(p => p.name), locked: placement.locked}
    setNote(writeDrafts([draft, ...readDrafts()]) ? t.draftSaved : t.imageError)
  }

  return (
    <div className="space-y-5">
      <RemixBanner />
      <div>
        <PageHeader title={t.result}><span className="text-brand">{roomName(plan.roomType)} · {styleName(plan.style)} · {baht(plan.budget)} · {plan.width} {t.cm}</span></PageHeader>
      </div>

      {!result.lockedOk && (
        <Card className="space-y-2 border-red-200 bg-red-50">
          <p className="text-sm text-red-800">{t.lockedFail}</p>
          {placement.locked.map(p => (
            <Button key={p.id} variant="outline" className="w-full" onClick={() => setLocked(placement.locked.filter(l => l.id !== p.id))}>{t.unlock} {p.name}</Button>
          ))}
        </Card>
      )}

      {result.items.length > 0 && (
        <section className="space-y-2">
          {sample && <p className="text-xs text-zinc-500">{t.sampleLabel}</p>}
          {editing
            ? <Placement roomImage={before} items={[...exacts.map(l => ({id: l.id, name: l.title, image: l.image ?? undefined})), ...result.items]} value={placement} onChange={v => updatePlacement({...placement, pos: v.pos, photos: v.photos})} />
            : <RoomCompare roomImage={before} items={result.items} exacts={exacts} pos={placement.pos} photos={placement.photos} flash={flash} />}
          <Button variant={editing ? 'default' : 'ghost'} className="w-full" onClick={() => setEditing(!editing)}>{editing ? t.doneEditing : t.editPlacement}</Button>
        </section>
      )}

      <section className="space-y-3 rounded-3xl border border-zinc-200 p-4">
        {exacts.map(l => (
          <p key={l.id} className="flex items-start gap-2 text-xs text-zinc-600"><Lock className="mt-0.5 size-4 shrink-0 text-brand" />{fill(t.lampLocked, {name: l.title})}</p>
        ))}
        <div role="group" aria-label={t.budgetPresets} className="grid grid-cols-2 gap-2">
          <Button variant="outline" aria-pressed={plan.budget === 3500} className={plan.budget === 3500 ? 'border-brand text-brand-dark' : ''} onClick={() => apply({budget: 3500})}>{t.presetCut}</Button>
          <Button variant="outline" aria-pressed={plan.budget === 5000} className={plan.budget === 5000 ? 'border-brand text-brand-dark' : ''} onClick={() => apply({budget: 5000})}>{t.presetBack}</Button>
        </div>
        {changes && (
          <div aria-live="polite" className="space-y-2 rounded-2xl bg-brand-soft p-3">
            <h2 className="text-sm font-bold text-brand-dark">{t.whatChanged}</h2>
            {changes.length === 0 ? <p className="text-sm">{t.noChange}</p> : (
              <ul className="space-y-2 text-sm">
                {changes.map(c => (
                  <li key={c.kind + c.item.id}>
                    {c.kind === 'replaced' && c.from ? (
                      <>
                        <span className="font-semibold text-brand-dark">{t.swapped}</span> {c.from.name} <span className="text-zinc-600">({spec(c.from)})</span> → {c.item.name} <span className="text-zinc-600">({spec(c.item)})</span>
                        <span className="block text-xs text-zinc-600">{c.why} · {t.sameSpot}</span>
                      </>
                    ) : (
                      <><span className="font-semibold text-red-700">− {t.removed}</span> {c.item.name} <span className="block text-xs text-zinc-600">{c.why}</span></>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {totals && <p className="text-xs font-semibold">{fill(t.totalChange, {from: baht(totals.from), to: baht(totals.to)})}</p>}
            {exacts.length > 0 && <p className="text-xs text-zinc-600">{t.exactNotCounted}</p>}
          </div>
        )}
      </section>

      {result.items.length === 0 && result.lockedOk ? (
        <Card className="space-y-3 text-center">
          <h2 className="text-lg font-bold">{t.noFit}</h2>
          <p className="text-sm text-zinc-500">{fill(t.noFitWhy, {room: roomName(plan.roomType)})}</p>
          <div className="flex flex-col gap-2">
            {hint.minBudget !== null && hint.minBudget > plan.budget && <Button variant="outline" onClick={() => apply({budget: hint.minBudget!})}>{fill(t.tryBudget, {n: hint.minBudget.toLocaleString('th-TH')})}</Button>}
            {hint.minWidth !== null && hint.minWidth > plan.width && <Button variant="outline" onClick={() => apply({width: hint.minWidth!})}>{fill(t.tryWidth, {n: hint.minWidth})}</Button>}
            <Button asChild variant="ghost"><Link href="/setup">{t.roomType}</Link></Button>
          </div>
        </Card>
      ) : result.items.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">{t.products}</h2>
            <span className="text-xs text-zinc-500">{result.items.length} {t.pieces}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <p className="rounded-2xl bg-brand-soft p-3"><span className="block text-zinc-600">{t.totalMax}</span><b className="text-base text-brand-dark">{baht(result.total)}</b><span className="block text-zinc-600">{t.ofBudget} {baht(plan.budget)}</span></p>
            <p className="rounded-2xl bg-brand-soft p-3"><span className="block text-zinc-600">{t.floorUsed}</span><b className="text-base text-brand-dark">{result.floorWidth} {t.cm}</b><span className="block text-zinc-600">{t.ofWidth} {plan.width} {t.cm}</span></p>
          </div>
          <ul className="space-y-2">
            {result.items.map(p => (
              <li key={p.id} className="flex items-center gap-2 rounded-2xl border border-zinc-200 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{p.name}{isLocked(p) && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[10px] text-white">{t.lockedTag}</span>}</span>
                  <span className="block text-xs text-zinc-500">
                    {isLocked(p) ? `${baht(p.priceMax)} · ${p.widthCm === null ? t.noSize : `${p.widthCm} ${t.cm}`} · ${t.userEntered}` : `${t.approx} ${baht(p.priceMin)}–${baht(p.priceMax)} · ${p.widthCm === null ? t.noSize : `${p.widthCm} ${t.cm}*`}`}
                  </span>
                </span>
                <a href={productUrl(p)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 shrink-0 items-center px-2 text-xs font-semibold text-brand">{isLocked(p) ? t.openListing : p.deeplink ? t.openExact : t.viewShopee} ›</a>
                {isLocked(p) && <button type="button" onClick={() => setLocked(placement.locked.filter(l => l.id !== p.id))} className="min-h-11 shrink-0 px-2 text-xs text-zinc-500">{t.unlock}</button>}
              </li>
            ))}
          </ul>
          {exacts.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-bold">{t.exactSection}</h3>
              <p className="text-xs text-zinc-500">{t.exactSectionHint}</p>
              {exacts.map(l => (
                <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-brand/40 px-3 py-2">
                  {l.image && <img src={l.image} alt={l.title} className="size-14 shrink-0 rounded-xl object-cover" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{l.title}<span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[10px] text-white">{t.exactTag}</span></span>
                    <span className="block text-xs text-zinc-500">{t.exactUnknown}</span>
                  </span>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 shrink-0 items-center px-2 text-xs font-semibold text-brand">{t.openExact} ›</a>
                </div>
              ))}
            </div>
          )}
          <ul className="list-disc space-y-1 pl-4 text-[11px] text-zinc-500">
            <li>{t.priceNote}</li>
            <li>* {t.sizeDemo}</li>
            <li>{t.fixtureNote}</li>
            <li>{t.linkNote}</li>
          </ul>
        </section>
      )}

      <Card className="space-y-4 bg-paper">
        <p className="text-sm font-bold">{t.adjust}</p>
        <NumberField label={t.budget} value={budget} onChange={setBudget} presets={[3500, 5000, 10000]} />
        <NumberField label={t.width} value={width} onChange={setWidth} presets={[60, 80, 120]} />
        <Button className="w-full" disabled={!(Number(budget) > 0 && Number(width) > 0)} onClick={() => apply({budget: Number(budget), width: Number(width)})}>{t.apply}</Button>
      </Card>


      <RealProductsPicker all={real} style={plan.style} selected={realIds} onChange={setRealIds} />

      {live && result.items.length > 0 && (
        <LiveRenderPanel provider={live} roomImage={before} meta={{styleId: plan.style, roomType: plan.roomType, budget: plan.budget, width: plan.width,
          items: [...result.items.map(p => p.id), ...exacts.map(l => l.id), ...realIds.filter(id => real.some(p => p.id === id))]
            .slice(0, 12).map(id => ({id, ...(placement.pos[id] ?? {x: 0, y: 0, w: 0})}))}} />
      )}

      <ListingForm roomType={plan.roomType} style={plan.style}
        onLock={(p, photo) => setLocked([...placement.locked, p], photo ? {...placement.photos, [p.id]: photo} : placement.photos)} />

      {result.items.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={saveDraft}>{t.saveDraft}</Button>
          <ShareDialog plan={plan} items={result.items} exacts={exacts} total={result.total} photo={sample ? null : before} />
        </div>
      )}
      {note && <p role="status" className="text-sm text-brand-dark">{note}</p>}
      {render && <p className="text-xs text-zinc-500">{render.ok ? fill(t.renderMock, {provider: render.provider ?? 'mock'}) : t.renderOffline}</p>}
      <div className="space-y-1">
        <Button variant="ghost" className="w-full" onClick={resetDemo}>{t.resetDemo}</Button>
        <p className="text-center text-xs text-zinc-500">{t.resetDemoHint}</p>
      </div>

    </div>
  )
}
