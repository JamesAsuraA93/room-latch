'use client'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {ArrowLeft, ArrowRight, Plus, RefreshCw, Search, Sparkles, Trash2} from 'lucide-react'
import {PageHeader} from '@/components/page-header'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog'
import {FurnitureImage, FurniturePrice} from '@/components/furniture-image'
import {BudgetSummary} from '@/components/budget-summary'
import {ImageSearch} from '@/components/image-search'
import {recommendationKey, requestRecommendation} from '@/lib/recommend-client'
import {recommendationFailureMessage} from '@/lib/recommend-status'
import {listingImagePath} from '@/lib/listing-image'
import {DEFAULT_PLAN, readPlan, styleName} from '@/lib/demo'
import {readRoomImages} from '@/lib/room-images'
import {readStyleReference} from '@/lib/style-reference'
import {readFloorPlan} from '@/lib/floor-plan'
import {FURNITURE_CATEGORIES, MAX_FURNITURE, furnitureCatalog, furnitureCategory, furnitureTotal, recommendFurniture, replaceFurniture, replaceUnavailableFurniture, selectionContext, type Furniture, type FurnitureCategory} from '@/lib/furniture'
import {useListingRank} from '@/lib/use-listing-rank'
import {readDesignSession, readSelection, saveDesignSession, saveSelection} from '@/lib/design-session'
import {designError} from '@/lib/design-errors'
import type {Job, Provider} from '@/lib/live-render-core'

export function ProductSelection({catalog, provider: initialProvider, renderUnavailableReason}: {catalog: Furniture[]; provider: Provider | null; renderUnavailableReason?: string}) {
  const router = useRouter()
  const [plan, setPlan] = useState(DEFAULT_PLAN)
  const [provider, setProvider] = useState(initialProvider)
  const [renderReason, setRenderReason] = useState(renderUnavailableReason)
  const [checkingRender, setCheckingRender] = useState(false)
  const checkRender = useCallback(async () => {
    setCheckingRender(true)
    try {
      const response = await fetch('/api/render/live', {cache: 'no-store', signal: AbortSignal.timeout(10000)})
      if (!response.ok) throw new Error('status')
      const status = await response.json()
      setProvider(status.provider === 'openai' ? 'openai' : null)
      setRenderReason(typeof status.reason === 'string' ? status.reason : undefined)
    } catch {
      setProvider(null); setRenderReason('ตรวจสอบการเชื่อมต่อระบบสร้างภาพไม่ได้ กรุณาลองอีกครั้ง')
    } finally { setCheckingRender(false) }
  }, [])
  useEffect(() => { void checkRender() }, [checkRender])
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
  const [recommendNotice, setRecommendNotice] = useState('')
  const [unavailableImages, setUnavailableImages] = useState<Set<string>>(() => new Set())
  const [readyImages, setReadyImages] = useState<Set<string>>(() => new Set())
  const imageUnavailable = useCallback((id: string) => setUnavailableImages(previous => previous.has(id) ? previous : new Set([...previous, id])), [])
  const imageReady = useCallback((id: string) => setReadyImages(previous => previous.has(id) ? previous : new Set([...previous, id])), [])
  const [activeJob, setActiveJob] = useState(false)
  const [recommending, setRecommending] = useState(true)
  const [recommendAttempt, setRecommendAttempt] = useState(0)
  const {fits, ranking, note: rankNote, rank} = useListingRank()
  const sending = useRef(false)
  const catalogRef = useRef(catalog)
  useEffect(() => { catalogRef.current = catalog }, [catalog])

  useEffect(() => {
    let cancelled = false
    // Snapshot for this attempt: catalog refreshes must not reset the selection or rerun AI.
    const catalog = catalogRef.current
    const p = readPlan(), context = selectionContext(p), previous = readSelection()
    const selected = previous?.context === context
      ? previous.items.map(item => catalog.find(candidate => candidate.id === item.id) ?? (listingImagePath(item.id) ? {...item, image: listingImagePath(item.id)} : undefined)).filter((item): item is Furniture => !!item).slice(0, MAX_FURNITURE)
      : recommendFurniture(catalog.filter(item => !!item.image), p)
    setPlan(p); setRoom(readRoomImages()[0] || ''); setItems(selected); setLoaded(true)
    if (previous?.context === context && recommendAttempt === 0) {
      setRecommending(false)
      setRecommendNotice(previous.notice || '')
    } else if (readRoomImages().length) {
      setRecommending(true); setNotice(''); setRecommendNotice(''); setConsent(false)
      void requestRecommendation(recommendationKey(p), recommendAttempt > 0).then(result => {
        if (cancelled) return
        const next: Furniture[] = result.items.slice(0, MAX_FURNITURE).map(item => ({
          id: item.id, name: item.title, category: furnitureCategory(item.title, item.category), styles: [p.style],
          price: item.price, priceKind: 'listed', image: item.image || listingImagePath(item.id) || catalog.find(candidate => candidate.id === item.id)?.image || null, url: item.url || '',
        }))
        setItems(next)
        const message = result.source === 'ai' ? (result.summary || 'AI เลือกตามความต้องการแล้ว เปลี่ยนสินค้าแต่ละชิ้นได้') : `${recommendationFailureMessage(result.fallbackReason)} — แสดงชุดสำรองตามสไตล์และงบ ความต้องการเพิ่มเติมยังไม่ได้รับการประเมิน`
        if (!saveSelection({context, items: next, source: result.source, notice: message})) setError('บันทึกตัวเลือกไม่ได้ กรุณาตรวจพื้นที่เบราว์เซอร์')
        setRecommendNotice(message)
      }).catch(() => {
        if (!cancelled) setRecommendNotice('ระบบแนะนำด้วย AI ยังไม่พร้อม แสดงชุดตามสไตล์และงบให้เลือกเองก่อน ความต้องการเพิ่มเติมยังไม่ได้ถูกประเมิน')
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
  }, [recommendAttempt])

  useEffect(() => {
    if (busy || recommending || !items.some(item => unavailableImages.has(item.id))) return
    const result = replaceUnavailableFurniture(items, catalog, plan, unavailableImages)
    setItems(result.items); setConsent(false)
    saveSelection({context: selectionContext(plan), items: result.items, notice: recommendNotice, source: readSelection()?.source})
    setNotice(result.unfilled.length
      ? `สินค้าบางชิ้นไม่มีรูป และยังหาสินค้าทดแทนในหมวดเดิมภายในงบไม่ได้ ลองเพิ่มงบหรือเลือกสินค้าเอง`
      : 'เปลี่ยนสินค้าที่รูปเปิดไม่ได้เป็นสินค้าในหมวดเดิมแล้ว ยอดรวมยังอยู่ในงบ')
  }, [unavailableImages, recommending, items, catalog, plan, recommendNotice, busy])

  const checkingImages = items.some(item => !readyImages.has(item.id) || unavailableImages.has(item.id))
  const overBudget = furnitureTotal(items).total > plan.budget

  function commit(next: Furniture[]) {
    setItems(next); setConsent(false)
    if (!saveSelection({context: selectionContext(plan), items: next, notice: recommendNotice})) setError('บันทึกตัวเลือกไม่ได้ กรุณาตรวจพื้นที่เบราว์เซอร์')
    else setError('')
  }
  function openPicker(id: string) {
    setPicker(id); setSearch(''); setCategory('all'); setLimit(24)
  }
  function choose(item: Furniture) {
    if (picker === null || items.some(p => p.id === item.id) || (picker === 'add' && items.length >= MAX_FURNITURE)) return false
    const next = picker === 'add' ? [...items, item] : replaceFurniture(items, picker, item)
    if (next === items) return false
    commit(next); setNotice(`${picker === 'add' ? 'เพิ่ม' : 'เปลี่ยนเป็น'} ${item.name}`); setPicker(null)
    return true
  }
  const candidates = useMemo(() => catalog.filter(item =>
    !!item.image && !unavailableImages.has(item.id) && !items.some(selected => selected.id === item.id) && (category === 'all' || item.category === category)
    && (!search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase()))
  ).sort((a, b) => (fits?.[b.id] ?? -1) - (fits?.[a.id] ?? -1)
    || Number(b.styles.includes(plan.style)) - Number(a.styles.includes(plan.style))
    || Number(b.priceKind === 'listed') - Number(a.priceKind === 'listed') || (a.price ?? Infinity) - (b.price ?? Infinity)), [catalog, items, category, search, plan.style, fits, unavailableImages])

  async function generate() {
    if (sending.current || checkingRender || recommending || checkingImages || overBudget || !provider || !consent || !items.length || !room || activeJob) return
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
        {recommendNotice && <p role="status" className="rounded-xl bg-white p-4 text-base leading-7 text-zinc-800">{recommendNotice}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">ชุดของคุณ <span className="text-sm font-normal text-zinc-500">{items.length}/{MAX_FURNITURE} ชิ้น</span></h2>
          <Button variant="outline" disabled={busy || recommending} onClick={() => setRecommendAttempt(value => value + 1)}><RefreshCw className="size-4" />ให้ AI เลือกใหม่</Button>
        </div>
        <div className="space-y-3">
          {items.map(item => <article key={item.id} className="grid grid-cols-[80px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-2xl border border-[#e6dfd7] bg-white p-3 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4">
            <FurnitureImage item={item} className="aspect-square w-full rounded-xl" onUnavailable={imageUnavailable} onReady={imageReady} />
            <div className="min-w-0 space-y-1">
              <span className="text-sm text-zinc-600">{FURNITURE_CATEGORIES[item.category]}</span>
              <h3 className="line-clamp-2 text-base font-medium leading-6" title={item.name}>{item.name}</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><FurniturePrice item={item} /><a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-brand underline underline-offset-4">ดูใน Shopee ↗</a></div>
            </div>
            <div className="col-span-2 flex justify-end gap-2 sm:col-span-1 sm:flex-col"><Button variant="outline" disabled={busy || recommending} onClick={() => openPicker(item.id)}><RefreshCw className="size-4" />เปลี่ยนสินค้า</Button><Button variant="ghost" disabled={busy || recommending} aria-label={`ลบ ${item.name}`} onClick={() => commit(items.filter(p => p.id !== item.id))}><Trash2 className="size-4" /><span className="hidden sm:inline">ลบ</span></Button></div>
          </article>)}
          {items.length < MAX_FURNITURE && <button type="button" disabled={busy || recommending} onClick={() => openPicker('add')} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#d4c7b9] bg-white/60 text-brand hover:bg-brand-soft"><Plus className="size-5" /><span className="font-semibold">เพิ่มสินค้า</span></button>}
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
            <label className="mb-4 flex cursor-pointer items-start gap-3 text-base leading-7 text-zinc-800"><input type="checkbox" checked={consent} disabled={busy || recommending || checkingImages || !items.length || !room} onChange={e => setConsent(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]" /><span>ยินยอมส่งรูปห้อง รูปอ้างอิง และข้อมูลที่เลือกให้ AI สร้างภาพ{provider === 'openai' ? ' มีค่าใช้จ่ายตามการใช้งาน' : ''}</span></label>
            <Button className="w-full" disabled={!provider || !consent || !items.length || !room || busy || recommending || checkingImages || overBudget || checkingRender} onClick={() => void generate()}><Sparkles className="size-4" />{busy ? 'กำลังส่งงาน…' : checkingRender ? 'กำลังตรวจระบบสร้างภาพ…' : 'สร้างภาพห้อง'}<ArrowRight className="size-4" /></Button>
            {checkingImages && !recommending && <p role="status" className="mt-3 text-sm text-zinc-700">กำลังตรวจรูปสินค้าและหาชิ้นทดแทน…</p>}
            {overBudget && <p role="alert" className="mt-3 text-sm text-red-700">ยอดรวมเกินงบ กรุณาเปลี่ยนสินค้าหรือปรับงบก่อนสร้างภาพ</p>}
            {!provider && !checkingRender && <div className="mt-3 space-y-2"><p role="status" className="text-sm text-amber-800">{renderReason || 'ยังไม่ได้เปิดระบบสร้างภาพบนเซิร์ฟเวอร์'} · ยังเลือกและเปลี่ยนสินค้าได้</p><Button variant="outline" className="w-full" onClick={() => void checkRender()}><RefreshCw className="size-4" />ตรวจระบบสร้างภาพอีกครั้ง</Button></div>}
            {!consent && provider && !checkingRender && <p className="mt-3 text-sm text-zinc-700">ติ๊กยินยอมด้านบนเพื่อสร้างภาพห้อง</p>}
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
          <div className="mb-3 space-y-2">
            <Button variant="outline" disabled={!room || ranking} onClick={() => void rank(room, plan.style, candidates.filter(item => item.id.startsWith('shopee-') && item.styles.includes(plan.style)).map(item => item.id))}>
              {ranking ? 'กำลังเรียงตามรูปห้อง…' : 'เรียงตามความเข้ากับรูปห้อง'}
            </Button>
            {rankNote && <p role="status" className="text-xs text-zinc-600">{rankNote}</p>}
            <details className="rl-disclosure">
              <summary>ค้นสินค้าด้วยรูป</summary>
              <ImageSearch style={plan.style} onPick={p => choose(catalog.find(item => item.id === p.id) ?? furnitureCatalog([{...p, image: listingImagePath(p.id)}], [])[0])} />
            </details>
          </div>
          <div className="space-y-2">
            {candidates.slice(0, limit).map(item => <button key={item.id} type="button" aria-label={`เลือก ${item.name}`} onClick={() => choose(item)} className="grid w-full grid-cols-[64px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-zinc-200 p-2 text-left hover:border-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:p-3">
              <FurnitureImage item={item} className="aspect-square w-full rounded-lg" onUnavailable={imageUnavailable} />
              <span className="min-w-0 space-y-1"><span className="line-clamp-2 text-sm font-medium sm:text-base">{item.name}</span><FurniturePrice item={item} />{fits?.[item.id] !== undefined && <span className="block text-xs text-brand">เข้ากับรูปห้อง {fits[item.id].toFixed(1)}/3</span>}</span>
              <span className="hidden px-3 text-sm font-semibold text-brand sm:block">เลือก</span>
            </button>)}
          </div>
          {!candidates.length && <p className="py-10 text-center text-sm text-zinc-500">ไม่พบสินค้า ลองเปลี่ยนประเภทหรือคำค้น</p>}
          {candidates.length > limit && <Button className="mt-4 w-full" variant="outline" onClick={() => setLimit(n => n + 24)}>ดูสินค้าเพิ่ม</Button>}
        </div>
      </DialogContent>
    </Dialog>
  </div>
}
