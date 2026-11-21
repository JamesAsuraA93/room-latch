'use client'
import {useEffect, useMemo, useState} from 'react'
import {readRoomImages} from '@/lib/room-images'
import {ReferenceFeedback} from '@/components/reference-feedback'
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
import {BEFORE, BUDGET_PRESETS, DEFAULT_PLAN, EMPTY_PLACEMENT, WIDTH_PRESETS, readDrafts, readJson, readPlacement, readPlan, roomName, savePlan, shopeeSearchUrl, startDemoSession, styleName, writeDrafts, writePlacement, type Placement as PlacementState, type Plan} from '@/lib/demo'
import {RENDER_KEY} from '@/lib/storage-keys'
import {fits, minimalSwap, noFitHint, pickSet, type Change, type Product} from '@/lib/plan'
import {Armchair, ArrowUpRight, Lamp, Ruler, Wallet, Package, SlidersHorizontal} from 'lucide-react'

const productUrl = (p: Product) => p.deeplink || shopeeSearchUrl(p.keyword)
const isLocked = (p: Product) => p.id.startsWith('custom-')

// หน้าหลักของ flow: ก่อน/หลังในกรอบเดียว หลัง = รูปห้องเดิม + รูปสินค้าที่จัดวาง (product first) ลาก/ย่อขยายอยู่ในโหมดแก้ไข
export function ResultView({products, live = null, real = []}: {products: Product[]; live?: Provider | null; real?: RealProduct[]}) {
  // สินค้าจริงที่เลือก (แยกจากชุดที่คิดงบ) อยู่ในหน่วยความจำของหน้านี้เท่านั้น
  const [renderSession, setRenderSession] = useState(0)
  const [realIds, setRealIds] = useState<string[]>([])
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN)
  const [before, setBefore] = useState(BEFORE)
  const [roomImages, setRoomImages] = useState<string[]>([])
  const [sample, setSample] = useState(true)
  const [placement, setPlacement] = useState<PlacementState>(EMPTY_PLACEMENT)
  const [editing, setEditing] = useState(false)
  const [budget, setBudget] = useState('')
  const [width, setWidth] = useState('')
  const [changes, setChanges] = useState<Change[] | null>(null)
  const [note, setNote] = useState('')
  const [render, setRender] = useState<{ok: boolean; provider?: string} | null>(null)

  useEffect(() => {
    const images = readRoomImages()
    setRoomImages(images)
    const p = readPlan()
    setPlan(p); setBudget(String(p.budget)); setWidth(String(p.width))
    setPlacement(readPlacement())
    setRender(readJson<{ok: boolean; provider?: string} | null>('session', RENDER_KEY, null))
    // รูปแรกคือภาพห้องหลัก ไม่มีรูป = ใช้ห้องตัวอย่าง
    setBefore(images[0] || BEFORE)
    setSample(!images[0] || !!p.sample)
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
  const exactItems = exacts.map(l => ({id: l.id, name: l.title, image: l.image ?? undefined}))
  // รูปสินค้าที่เลือกแนบให้ภาพ AI ได้: ชุดแนะนำ + ประกาศจริง + สินค้าจริงที่เลือก (id ซ้ำนับครั้งเดียว)
  const photoOptions = Array.from(new Map([
    ...result.items.map(p => ({id: p.id, name: p.name, image: placement.photos[p.id], widthCm: p.widthCm ?? undefined})),
    ...exactItems,
    ...real.filter(p => realIds.includes(p.id)).map(p => ({id: p.id, name: p.title})),
  ].map(p => [p.id, p])).values())

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
  const unlock = (id: string) => setLocked(placement.locked.filter(l => l.id !== id))

  /** ซ้อมเดโมใหม่: ห้องตัวอย่าง + ค่าเริ่มต้น ไม่แตะของที่เซฟ/ไลก์/draft */
  function resetDemo() {
    startDemoSession()
    setRenderSession(n => n + 1)
    setRoomImages(readRoomImages())
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
    <div className="space-y-6">
      <RemixBanner />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="ห้องของคุณ ในแบบที่ชอบ"><span>{roomName(plan.roomType)} · {styleName(plan.style)}</span></PageHeader>
        <Button asChild variant="outline"><Link href="/style"><SlidersHorizontal className="size-4" />เปลี่ยนสไตล์</Link></Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          {icon: Wallet, label: 'งบที่ตั้งไว้', value: baht(plan.budget)},
          {icon: Package, label: 'ชุดแนะนำ', value: `${result.items.length} ชิ้น`},
          {icon: Ruler, label: 'ความกว้างมุม', value: `${plan.width} ซม.`},
        ].map(({icon: Icon, label, value}) => (
          <div key={label} className="flex flex-col gap-2 rounded-[22px] bg-white p-4 md:flex-row md:items-center md:gap-4">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon className="size-5" /></span>
            <div>
              <p className="text-[11px] text-zinc-500">{label}</p>
              <p className="mt-1 text-base font-semibold md:text-xl">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <LiveRenderPanel key={renderSession} provider={live ?? 'openai'} ready={!!live} roomImage={before} roomImages={roomImages}
        products={photoOptions}
        meta={{styleId: plan.style, roomType: plan.roomType, budget: plan.budget, width: plan.width, items: result.items.map(p => ({id: p.id, ...(placement.pos[p.id] ?? {x: 0, y: 0, w: 0})}))}} />
      <ReferenceFeedback count={roomImages.length} />

      <details className="rl-disclosure">
        <summary>ชุดสินค้าแนะนำและงบประมาณ</summary>
        <aside className="space-y-5">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="rl-section-label">CURATED FOR YOUR ROOM</p>
                <h2 className="mt-2 text-lg font-semibold">ชุดของที่แนะนำ</h2>
              </div>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-[#ffdbb0] text-brand"><Armchair className="size-5" /></span>
            </div>
            <div className="flex items-end justify-between rounded-2xl bg-paper p-4">
              <div>
                <p className="text-xs text-zinc-500">ราคารวมประมาณ ไม่เกิน</p>
                <p className="mt-1 text-2xl font-semibold text-brand">{baht(result.total)}</p>
              </div>
              <span className="text-xs text-zinc-500">งบ {baht(plan.budget)}</span>
            </div>
            {!result.lockedOk && (
              <div role="alert" className="space-y-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                <p>{t.lockedFail}</p>
                {placement.locked.map(p => <Button key={p.id} variant="outline" onClick={() => unlock(p.id)}>{t.unlock} {p.name}</Button>)}
              </div>
            )}
            {!result.items.length && result.lockedOk && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500">{t.noFit}</p>
                {hint.minBudget !== null && hint.minBudget > plan.budget && <Button variant="outline" onClick={() => apply({budget: hint.minBudget!})}>{fill(t.tryBudget, {n: hint.minBudget.toLocaleString('th-TH')})}</Button>}
                {hint.minWidth !== null && hint.minWidth > plan.width && <Button variant="outline" onClick={() => apply({width: hint.minWidth!})}>{fill(t.tryWidth, {n: hint.minWidth})}</Button>}
                <Button asChild variant="ghost"><Link href="/setup">ปรับงบและขนาดห้อง</Link></Button>
              </div>
            )}
            <ul className="space-y-3">
              {result.items.map(p => (
                <li key={p.id} className="flex items-start gap-3 border-b border-[#f0ece7] pb-3 last:border-0 last:pb-0">
                  {placement.photos[p.id] ? (
                    <img src={placement.photos[p.id]} alt={p.name} className="size-16 shrink-0 rounded-2xl object-contain" />
                  ) : (
                    <span className="flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-paper text-[#a58a70]">
                      {p.slot === 'desk' ? <Package className="size-6" /> : /โคม|ไฟ/.test(p.name) ? <Lamp className="size-6" /> : <Armchair className="size-6" />}
                      <span className="text-[8px] text-zinc-500">ยังไม่มีภาพ</span>
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-6">{p.name.replace(' (fixture)', '')}</p>
                    <p className="mt-1 text-xs text-zinc-500">{baht(p.priceMin)}–{baht(p.priceMax)} · {p.widthCm === null ? t.noSize : `${p.widthCm} ซม.`}</p>
                    <a href={productUrl(p)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-brand">
                      {isLocked(p) ? t.openListing : p.deeplink ? t.openExact : t.viewShopee}
                      <ArrowUpRight className="size-3" />
                    </a>
                    {isLocked(p) && <button onClick={() => unlock(p.id)} className="ml-3 min-h-9 text-xs text-zinc-500">{t.unlock}</button>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-[11px] leading-5 text-zinc-500">ราคาและขนาดเป็นข้อมูลประมาณ/ตัวอย่าง กรุณาตรวจรายละเอียดสินค้าก่อนซื้อ</p>
            {result.items.length > 0 && <Button variant="outline" className="w-full" onClick={saveDraft}>{t.saveDraft}</Button>}
          </Card>
          <details className="rl-disclosure">
            <summary>ปรับงบและขนาดพื้นที่</summary>
            <div className="space-y-4">
              <NumberField label={t.budget} value={budget} onChange={setBudget} presets={BUDGET_PRESETS} />
              <NumberField label={t.width} value={width} onChange={setWidth} presets={WIDTH_PRESETS} />
              <Button className="w-full" disabled={!(Number(budget) > 0 && Number(width) > 0)} onClick={() => apply({budget: Number(budget), width: Number(width)})}>{t.apply}</Button>
              {changes && (
                <div role="status" className="space-y-2 rounded-2xl bg-brand-soft p-3 text-xs">
                  <p className="font-semibold">{t.whatChanged}</p>
                  {!changes.length
                    ? <p>{t.noChange}</p>
                    : changes.map(c => <p key={c.kind + c.item.id}>{c.kind === 'replaced' ? `${c.from?.name} → ${c.item.name}` : `${t.removed} ${c.item.name}`} · {c.why}</p>)}
                  {totals && <p>{baht(totals.from)} → {baht(totals.to)}</p>}
                </div>
              )}
            </div>
          </details>
        </aside>
      </details>

      <details className="rl-disclosure">
        <summary>ทดลองตำแหน่งด้วยภาพซ้อน 2D</summary>
        <p className="mb-3 text-xs text-zinc-500">เครื่องมือจัดตำแหน่งเบื้องต้น ภาพจำลอง AI อยู่ด้านบน</p>
        {editing
          ? <Placement roomImage={before} items={[...exactItems, ...result.items]} value={placement} onChange={v => updatePlacement({...placement, pos: v.pos, photos: v.photos})} />
          : <RoomCompare roomImage={before} items={result.items} exacts={exacts} pos={placement.pos} photos={placement.photos} flash={flash} />}
        <Button variant="ghost" onClick={() => setEditing(!editing)}>{editing ? t.doneEditing : t.editPlacement}</Button>
      </details>

      <details className="rl-disclosure">
        <summary>เลือกสินค้าเพิ่มเติมจาก Shopee {realIds.length ? `· เลือกแล้ว ${realIds.length} ชิ้น` : ''}</summary>
        <RealProductsPicker all={real} style={plan.style} selected={realIds} onChange={setRealIds} />
      </details>
      <details className="rl-disclosure">
        <summary>เพิ่มสินค้าของคุณจากลิงก์ประกาศ</summary>
        <ListingForm roomType={plan.roomType} style={plan.style} onLock={(p, photo) => setLocked([...placement.locked, p], photo ? {...placement.photos, [p.id]: photo} : placement.photos)} />
      </details>
      {exacts.length > 0 && (
        <details className="rl-disclosure">
          <summary>ประกาศสินค้าอ้างอิง · {exacts.length} รายการ</summary>
          <div className="space-y-3">
            {exacts.map(l => (
              <div key={l.id} className="flex items-center gap-3">
                {l.image && <img src={l.image} alt={l.title} className="size-16 rounded-xl object-contain" />}
                <div>
                  <p className="text-sm font-medium">{l.title}</p>
                  <p className="text-xs text-zinc-500">{t.exactUnknown}</p>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-xs text-brand">{t.openExact} ↗</a>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      {result.items.length > 0 && (
        <div className="flex justify-end">
          <ShareDialog plan={plan} items={result.items} exacts={exacts} total={result.total} photo={sample ? null : before} />
        </div>
      )}
      {note && <p role="status" className="text-sm text-brand-dark">{note}</p>}
      <details className="rl-disclosure">
        <summary>รายละเอียดการคำนวณและเริ่มใหม่</summary>
        <div className="space-y-3 text-xs leading-6 text-zinc-500">
          <p>{t.priceNote}</p>
          <p>{t.sizeDemo}</p>
          <p>{t.linkNote}</p>
          {render && <p>{render.ok ? fill(t.renderMock, {provider: render.provider ?? 'mock'}) : t.renderOffline}</p>}
          <Button variant="ghost" onClick={resetDemo}>{t.resetDemo}</Button>
        </div>
      </details>
    </div>
  )
}
