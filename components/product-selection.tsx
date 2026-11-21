'use client'
import {useEffect, useMemo, useRef, useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {ArrowLeft, ArrowRight, Plus, RefreshCw, Search, Sparkles, Trash2} from 'lucide-react'
import {PageHeader} from '@/components/page-header'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog'
import {FurnitureImage, FurniturePrice} from '@/components/furniture-image'
import {BudgetSummary} from '@/components/budget-summary'
import {recommendationKey, requestRecommendation} from '@/lib/recommend-client'
import {DEFAULT_PLAN, readPlan, styleName} from '@/lib/demo'
import {readRoomImages} from '@/lib/room-images'
import {readStyleReference} from '@/lib/style-reference'
import {readFloorPlan} from '@/lib/floor-plan'
import {FURNITURE_CATEGORIES, MAX_FURNITURE, furnitureCategory, recommendFurniture, replaceFurniture, selectionContext, type Furniture, type FurnitureCategory} from '@/lib/furniture'
import {readDesignSession, readSelection, saveDesignSession, saveSelection} from '@/lib/design-session'
import {designError} from '@/lib/design-errors'
import type {Job, Provider} from '@/lib/live-render-core'

export function ProductSelection({catalog, provider}: {catalog: Furniture[]; provider: Provider | null}) {
  const router = useRouter()
  const [plan, setPlan] = useState(DEFAULT_PLAN)
  const [room, setRoom] = useState('')
  const [items, setItems] = useState<Furniture[]>([])
  const [loaded, setLoaded] = useState(false)
  const [picker, setPicker] = useState<string | null>(null)
  const [category, setCategory] = useState<FurnitureCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(24)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeJob, setActiveJob] = useState(false)
  const [recommending, setRecommending] = useState(true)
  const [recommendAttempt, setRecommendAttempt] = useState(0)
  const sending = useRef(false)

  useEffect(() => {
    let cancelled = false
    const p = readPlan(), context = selectionContext(p), previous = readSelection()
    const selected = previous?.context === context
      ? previous.items.map(item => catalog.find(candidate => candidate.id === item.id) ?? (item.id.startsWith('shopee-') ? item : undefined)).filter((item): item is Furniture => !!item).slice(0, MAX_FURNITURE)
      : recommendFurniture(catalog, p)
    setPlan(p); setRoom(readRoomImages()[0] || ''); setItems(selected); setLoaded(true)
    if (previous?.context === context && recommendAttempt === 0) {
      setRecommending(false)
    } else if (readRoomImages().length) {
      setRecommending(true); setNotice(''); setConsent(false)
      void requestRecommendation(recommendationKey(p), recommendAttempt > 0).then(result => {
        if (cancelled) return
        const next: Furniture[] = result.items.slice(0, MAX_FURNITURE).map(item => ({
          id: item.id, name: item.title, category: furnitureCategory(item.title, item.category), styles: [p.style],
          price: item.price, priceKind: 'listed', image: item.image ?? catalog.find(candidate => candidate.id === item.id)?.image ?? null, url: item.url || '',
        }))
        setItems(next)
        if (!saveSelection({context, items: next})) setError('บันทึกตัวเลือกไม่ได้ กรุณาตรวจพื้นที่เบราว์เซอร์')
        setNotice(result.source === 'ai' ? (result.summary || 'AI เลือกตามความต้องการแล้ว เปลี่ยนสินค้าแต่ละชิ้นได้') : 'ชุดสำรองตามสไตล์และงบ ยังไม่ได้ใช้ AI ตรวจความต้องการเพิ่มเติม กรุณาตรวจสินค้า หรือกดให้ AI เลือกใหม่')
      }).catch(() => {
        if (!cancelled) setNotice('ระบบแนะนำด้วย AI ยังไม่พร้อม แสดงชุดตามสไตล์และงบให้เลือกเองก่อน ความต้องการเพิ่มเติมยังไม่ได้ถูกประเมิน')
      }).finally(() => { if (!cancelled) setRecommending(false) })
    } else setRecommending(false)
    const saved = readDesignSession()
    if (saved?.job.status === 'running') {
      setActiveJob(true)
      void fetch(`/api/render/live/${saved.job.id}`, {cache: 'no-store', signal: AbortSignal.timeout(15000)})
        .then(async response => {
          if (response.status === 404) { setActiveJob(false); return }
          if (!response.ok) return
          const body = await response.json()
          if (body.job) { setActiveJob(body.job.status === 'running'); saveDesignSession({...saved, job: body.job}) }
        }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [catalog, recommendAttempt])

  function commit(next: Furniture[]) {
    setItems(next); setConsent(false)
    if (!saveSelection({context: selectionContext(plan), items: next})) setError('บันทึกตัวเลือกไม่ได้ กรุณาตรวจพื้นที่เบราว์เซอร์')
    else setError('')
  }
  function openPicker(id: string) {
    setPicker(id); setSearch(''); setCategory('all'); setLimit(24)
  }
  function choose(item: Furniture) {
    const next = picker === 'add' ? [...items, item].slice(0, MAX_FURNITURE) : replaceFurniture(items, picker!, item)
    commit(next); setNotice(`${picker === 'add' ? 'เพิ่ม' : 'เปลี่ยนเป็น'} ${item.name}`); setPicker(null)
  }
  const candidates = useMemo(() => catalog.filter(item =>
    !items.some(selected => selected.id === item.id) && (category === 'all' || item.category === category)
    && (!search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase()))
  ).sort((a, b) => Number(b.styles.includes(plan.style)) - Number(a.styles.includes(plan.style))
    || Number(b.priceKind === 'listed') - Number(a.priceKind === 'listed') || (a.price ?? Infinity) - (b.price ?? Infinity)), [catalog, items, category, search, plan.style])

  async function generate() {
    if (sending.current || recommending || !provider || !consent || !items.length || !room || activeJob) return
    sending.current = true; setBusy(true); setError('')
    try {
      if (!saveSelection({context: selectionContext(plan), items})) throw new Error('บันทึกตัวเลือกไม่ได้ กรุณาตรวจพื้นที่เบราว์เซอร์')
      const images = readRoomImages()
      if (!images.length) throw new Error('กรุณาเพิ่มรูปห้องก่อน')
      const form = new FormData()
      for (const [i, image] of images.entries()) {
        const response = await fetch(image, {signal: AbortSignal.timeout(15000)})
        if (!response.ok) throw new Error('อ่านรูปห้องไม่ได้ กรุณาเลือกรูปใหม่')
        form.append('image', await response.blob(), `room-${i}`)
      }
      const reference = readStyleReference()
      if (reference) form.append('styleReference', await (await fetch(reference)).blob(), 'style-reference')
      const floorPlan = readFloorPlan()
      if (floorPlan) form.append('floorPlan', await (await fetch(floorPlan)).blob(), 'floor-plan')
      if (plan.areaM2 != null) form.append('roomArea', String(plan.areaM2))
      form.append('mode', 'selection'); form.append('consent', 'yes')
      form.append('meta', JSON.stringify({styleId: plan.style, roomType: plan.roomType, budget: plan.budget, width: plan.width, items: items.map(item => ({id: item.id, x: 0, y: 0, w: 0}))}))
      const response = await fetch('/api/render/live', {method: 'POST', body: form, signal: AbortSignal.timeout(60000)})
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.job?.id) throw new Error(designError(body.error?.code))
      const job = body.job as Job
      saveDesignSession({job, items, plan, before: room, photoCount: body.productPhotoCount ?? 0})
      router.push(`/result?job=${encodeURIComponent(job.id)}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'ส่งคำขอไม่ได้ กรุณาลองใหม่') }
    finally { sending.current = false; setBusy(false) }
  }

  if (!loaded) return <div role="status" className="py-20 text-center text-zinc-500">กำลังหาสินค้าให้คุณ…</div>
  return <div className="rl-flow pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <PageHeader title="เลือกของเข้าห้อง">แนะนำตามสไตล์{styleName(plan.style)} · เปลี่ยน เพิ่ม หรือลบได้</PageHeader>
      <Button asChild variant="outline"><Link href="/upload"><ArrowLeft className="size-4" />แก้ไขห้องและงบ</Link></Button>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="สินค้าที่เลือก" className="min-w-0 space-y-4">
        {plan.need && <div className="rounded-2xl border border-[#e6dfd7] bg-white p-4"><h2 className="font-semibold">ความต้องการของคุณ</h2><p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-zinc-700">{plan.need}</p></div>}
        {recommending && <p role="status" className="flex items-center gap-2 rounded-xl bg-brand-soft p-4 text-base text-brand"><Sparkles className="size-5 animate-pulse" />กำลังเลือกสินค้าตามความต้องการ สไตล์ และงบ…</p>}
        {notice && <p role="status" className="rounded-xl bg-white p-4 text-base leading-7 text-zinc-800">{notice}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">ชุดของคุณ <span className="text-sm font-normal text-zinc-500">{items.length}/{MAX_FURNITURE} ชิ้น</span></h2>
          <Button variant="outline" disabled={busy || recommending} onClick={() => setRecommendAttempt(value => value + 1)}><RefreshCw className="size-4" />ให้ AI เลือกใหม่</Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {items.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-[#e6dfd7] bg-white">
            <div className="grid grid-cols-[96px_minmax(0,1fr)] sm:block">
            <FurnitureImage item={item} className="h-full min-h-28 sm:aspect-[16/10] sm:h-auto" />
            <div className="min-w-0 space-y-2 p-3 sm:space-y-3 sm:p-4">
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs text-brand">{FURNITURE_CATEGORIES[item.category]}</span>
              <h3 className="line-clamp-2 min-h-12 text-base font-medium leading-6">{item.name}</h3>
              <div className="flex flex-wrap items-center justify-between gap-2"><FurniturePrice item={item} /><a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-brand underline underline-offset-4">ดูใน Shopee ↗</a></div>
            </div>
            </div>
            <div className="flex gap-2 px-3 pb-3 sm:px-4 sm:pb-4"><Button variant="outline" className="flex-1" disabled={busy || recommending} onClick={() => openPicker(item.id)}><RefreshCw className="size-4" />เปลี่ยนสินค้า</Button><Button variant="ghost" disabled={busy || recommending} aria-label={`ลบ ${item.name}`} onClick={() => commit(items.filter(p => p.id !== item.id))}><Trash2 className="size-4" /></Button></div>
          </article>)}
          {items.length < MAX_FURNITURE && <button type="button" disabled={busy || recommending} onClick={() => openPicker('add')} className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#d4c7b9] bg-white/60 text-brand hover:bg-brand-soft"><Plus className="size-7" /><span className="font-semibold">เพิ่มสินค้า</span></button>}
        </div>
        {!items.length && <p className="text-sm text-zinc-600">ยังไม่มีสินค้าที่เลือก ลองเพิ่มสินค้าหรือปรับงบ</p>}
      </section>

      <aside className="space-y-5 rounded-2xl border border-[#e6dfd7] bg-white p-5 lg:sticky lg:top-6">
        {room ? <img src={room} alt="ห้องที่จะออกแบบ" className="max-h-44 w-full rounded-xl object-cover" /> : <p role="alert" className="text-base text-red-800">ยังไม่มีรูปห้อง <Link href="/upload" className="underline">เพิ่มรูปห้องก่อน</Link></p>}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">สรุปชุดของคุณ</h2>
          <BudgetSummary items={items} budget={plan.budget} />
        </div>
        <div className="border-t border-zinc-100 pt-4">
          {activeJob ? <Button asChild className="w-full"><Link href="/result">ดูภาพที่กำลังสร้าง<ArrowRight className="size-4" /></Link></Button> : <>
            <label className="mb-4 flex cursor-pointer items-start gap-3 text-base leading-7 text-zinc-800"><input type="checkbox" checked={consent} disabled={busy || recommending} onChange={e => setConsent(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]" /><span>ยินยอมส่งรูปห้อง รูปอ้างอิง และข้อมูลที่เลือกให้ AI สร้างภาพ{provider === 'openai' ? ' มีค่าใช้จ่ายตามการใช้งาน' : ''}</span></label>
            <Button className="w-full" disabled={!provider || !consent || !items.length || !room || busy || recommending} onClick={() => void generate()}><Sparkles className="size-4" />{busy ? 'กำลังส่งงาน…' : 'สร้างภาพห้อง'}<ArrowRight className="size-4" /></Button>
            {!provider && <p role="status" className="mt-3 text-sm text-amber-800">เลือกสินค้าได้ แต่ระบบสร้างภาพยังไม่พร้อม</p>}
          </>}
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        </div>
      </aside>
    </div>

    <Dialog open={picker !== null} onOpenChange={open => { if (!open) setPicker(null) }}>
      <DialogContent className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white p-4 shadow-lg sm:p-6">
        <DialogTitle className="text-xl font-semibold">{picker === 'add' ? 'เพิ่มสินค้าเข้าห้อง' : 'เปลี่ยนสินค้า'}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-zinc-500">เลือกข้ามประเภทได้ เช่น เปลี่ยนเก้าอี้เป็นโซฟา</DialogDescription>
        <div className="relative my-4"><Search aria-hidden="true" className="absolute left-3 top-3.5 size-5 text-zinc-400" /><input aria-label="ค้นหาสินค้า" placeholder="ค้นหาชื่อสินค้า" value={search} onChange={e => { setSearch(e.target.value); setLimit(24) }} className="min-h-12 w-full rounded-xl border border-zinc-200 pl-10 pr-4 text-base" /></div>
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-3" aria-label="ประเภทสินค้า">
          {(['all', ...Object.keys(FURNITURE_CATEGORIES)] as (FurnitureCategory | 'all')[]).map(cat => <button key={cat} type="button" aria-pressed={category === cat} onClick={() => { setCategory(cat); setLimit(24) }} className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm ${category === cat ? 'border-brand bg-brand text-white' : 'border-zinc-200'}`}>{cat === 'all' ? 'ทั้งหมด' : FURNITURE_CATEGORIES[cat]}</button>)}
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain pt-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {candidates.slice(0, limit).map(item => <button key={item.id} type="button" aria-label={`เลือก ${item.name}`} onClick={() => choose(item)} className="overflow-hidden rounded-xl border border-zinc-200 text-left hover:border-brand">
              <FurnitureImage item={item} className="aspect-[4/3]" />
              <span className="block space-y-2 p-3"><span className="line-clamp-2 min-h-10 text-sm font-medium">{item.name}</span><FurniturePrice item={item} /></span>
            </button>)}
          </div>
          {!candidates.length && <p className="py-10 text-center text-sm text-zinc-500">ไม่พบสินค้า ลองเปลี่ยนประเภทหรือคำค้น</p>}
          {candidates.length > limit && <Button className="mt-4 w-full" variant="outline" onClick={() => setLimit(n => n + 24)}>ดูสินค้าเพิ่ม</Button>}
        </div>
      </DialogContent>
    </Dialog>
  </div>
}
