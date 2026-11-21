'use client'
import {useEffect, useRef, useState} from 'react'
import Link from 'next/link'
import {ArrowDownToLine, Bookmark, Check, CheckCircle2, CircleAlert, Clock3, RefreshCw, Sparkles} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {PageHeader} from '@/components/page-header'
import {FurnitureImage, FurniturePrice} from '@/components/furniture-image'
import {baht, t} from '@/lib/copy'
import {readDrafts, readPlan, styleName, writeDrafts} from '@/lib/demo'
import {BudgetSummary} from '@/components/budget-summary'
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog'
import {elapsedLabel, isTerminalJob} from '@/lib/render-outcome'
import {readDesignSession, readSelection, saveDesignSession, type DesignSession} from '@/lib/design-session'
import {readRoomImages} from '@/lib/room-images'
import {designError} from '@/lib/design-errors'
import type {Job} from '@/lib/live-render-core'

export function DesignResult({jobId}: {jobId?: string}) {
  const [session, setSession] = useState<DesignSession | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<'before' | 'after'>('after')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [outcomeOpen, setOutcomeOpen] = useState(false)
  const [confirmedJob, setConfirmedJob] = useState('')
  const [now, setNow] = useState(Date.now())
  const announced = useRef(new Set<string>())
  const terminal = useRef(false)

  useEffect(() => {
    const job = session?.job
    if (!job || !isTerminalJob(job) || confirmedJob !== job.id || announced.current.has(job.id)) return
    announced.current.add(job.id)
    setOutcomeOpen(true)
  }, [session?.job, confirmedJob])

  useEffect(() => {
    if (session?.job.status !== 'running') return
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(clock)
  }, [session?.job.status])

  useEffect(() => {
    const previous = readDesignSession()
    const initial = jobId && previous?.job.id !== jobId ? {
      job: {id: jobId, status: 'running', provider: 'codex', startedAt: Date.now()} as Job,
      plan: readPlan(), items: readSelection()?.items || [], before: readRoomImages()[0] || '', photoCount: 0,
    } : previous
    setSession(initial); setLoaded(true)
    terminal.current = false; setConfirmedJob(''); setOutcomeOpen(false)
    if (!initial) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()
    async function watch() {
      try {
        const response = await fetch(`/api/render/live/${initial!.job.id}`, {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])})
        if (!active || terminal.current) return
        if (response.status === 404) {
          const missing = {...initial!, job: {...initial!.job, status: 'failed' as const, error: 'not_found', output: undefined}}
          terminal.current = true
          setSession(missing); saveDesignSession(missing); setConfirmedJob(missing.job.id); return
        }
        if (!response.ok) throw new Error('status')
        const {job} = await response.json() as {job: Job}
        if (!active || terminal.current) return
        const next = {...initial!, job}
        terminal.current = isTerminalJob(job)
        setSession(next); saveDesignSession(next); setError(''); setConfirmedJob(job.id)
        if (job.status === 'running') timer = setTimeout(() => void watch(), 2500)
      } catch {
        if (!active || terminal.current) return
        setError('ตรวจสถานะไม่ได้ กำลังลองเชื่อมต่อใหม่ โดยไม่สร้างภาพซ้ำ')
        timer = setTimeout(() => void watch(), 5000)
      }
    }
    void watch()
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [jobId])

  async function cancel() {
    if (!session || cancelBusy) return
    setCancelBusy(true)
    try {
      const response = await fetch(`/api/render/live/${session.job.id}`, {method: 'DELETE'})
      if (!response.ok) throw new Error('cancel')
      const status = await fetch(`/api/render/live/${session.job.id}`, {cache: 'no-store'})
      if (!status.ok) throw new Error('status')
      const {job} = await status.json()
      terminal.current = isTerminalJob(job)
      const next = {...session, job}; setSession(next); saveDesignSession(next); setConfirmedJob(job.id)
    } catch { setError('ยกเลิกไม่สำเร็จ กรุณาลองใหม่') }
    finally { setCancelBusy(false) }
  }
  function save() {
    if (!session || saved) return
    const draft = {id: `design-${session.job.id}`, savedAt: Date.now(), plan: session.plan, items: session.items.map(p => p.name), locked: [], furniture: session.items, renderJob: session.job, photoCount: session.photoCount}
    if (writeDrafts([draft, ...readDrafts().filter(d => d.id !== draft.id)])) setSaved(true)
    else setError('บันทึกไม่ได้ พื้นที่ในเบราว์เซอร์อาจเต็ม')
  }

  if (!loaded) return <div role="status" className="py-20 text-center text-zinc-500">กำลังเปิดผลลัพธ์…</div>
  if (!session) return <div className="space-y-5 py-12 text-center">
    <h1 className="text-2xl font-semibold">ยังไม่มีผลลัพธ์</h1><p className="text-zinc-600">เลือกรูปห้องและสินค้าที่ชอบก่อนสร้างภาพ</p>
    <Button asChild><Link href="/upload">เริ่มออกแบบห้อง</Link></Button>
  </div>
  const running = session.job.status === 'running'
  const succeeded = session.job.status === 'succeeded' && !!session.job.output
  const output = succeeded ? `/api/render/live/${session.job.id}/image` : null
  const duration = elapsedLabel(session.job.startedAt, running ? now : session.job.finishedAt)
  const failureReason = designError(session.job.error || session.job.status)

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <PageHeader title={running ? 'กำลังออกแบบห้องของคุณ' : succeeded ? 'ห้องของคุณ พร้อมแล้ว' : 'ผลลัพธ์ห้องของคุณ'}>สไตล์{styleName(session.plan.style)} · {session.items.length} ชิ้น · งบ {baht(session.plan.budget)}</PageHeader>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link href="/products"><RefreshCw className="size-4" />เปลี่ยนสินค้า</Link></Button>
        {succeeded && <><Button variant="outline" onClick={save} disabled={saved}>{saved ? <Check className="size-4" /> : <Bookmark className="size-4" />}{saved ? 'บันทึกแล้ว' : 'บันทึกแบบ'}</Button><Button asChild><a href={output!} download="roomlatch-room.png"><ArrowDownToLine className="size-4" />ดาวน์โหลด</a></Button></>}
        {succeeded && <Button asChild variant="outline"><Link href="/walk">{t.walkDemo}</Link></Button>}
      </div>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="ภาพผลลัพธ์" className="min-w-0 space-y-4">
        <div className="overflow-hidden rounded-2xl border border-[#e6dfd7] bg-white p-3 sm:p-4">
          {succeeded && <div className="mb-3 flex justify-end"><div className="flex rounded-xl bg-paper p-1">{(['before', 'after'] as const).map(mode => <button key={mode} type="button" disabled={mode === 'before' && !session.before} aria-pressed={view === mode} onClick={() => setView(mode)} className={`min-h-11 rounded-lg px-5 text-sm disabled:opacity-40 ${view === mode ? 'bg-brand text-white' : 'text-zinc-600'}`}>{mode === 'before' ? 'ก่อนแต่ง' : 'ผลลัพธ์'}</button>)}</div></div>}
          <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-xl bg-[#e9e2d9] lg:min-h-[55dvh]">
            {(output || session.before) && <img src={view === 'after' && output ? output : session.before || output!} alt={view === 'after' && output ? 'ผลลัพธ์ห้องพร้อมสินค้าที่เลือก' : 'ภาพห้องก่อนแต่ง'} className="max-h-[72dvh] w-full object-contain" />}
            {running && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper/95 p-6 text-center"><Sparkles className="size-10 animate-pulse text-brand motion-reduce:animate-none" /><h2 className="text-xl font-semibold">กำลังจัดของที่เลือกลงในห้อง</h2><p className="text-lg font-semibold tabular-nums text-zinc-900">ใช้เวลาแล้ว {duration}</p><p className="text-base text-zinc-700">อาจใช้เวลาหลายนาที กลับมาดูหน้านี้ได้</p><Button variant="outline" disabled={cancelBusy} onClick={() => void cancel()}>{cancelBusy ? 'กำลังยกเลิก…' : 'ยกเลิกการสร้าง'}</Button></div>}
          </div>
          {!running && !succeeded && <div role="alert" className="mt-4 space-y-3 rounded-xl border border-red-200 bg-red-50 p-5 text-center"><h2 className="text-xl font-bold text-red-900">{session.job.status === 'cancelled' ? 'ยกเลิกการสร้างภาพแล้ว' : 'สร้างภาพไม่สำเร็จ'}</h2><p className="text-base leading-7 text-red-900">{failureReason}</p><p className="font-semibold text-zinc-800">เวลาที่ใช้: {duration}</p><Button onClick={() => setOutcomeOpen(true)} variant="outline">ดูรายละเอียด</Button><Button asChild className="ml-2"><Link href="/products">กลับไปเลือกสินค้า</Link></Button></div>}
        </div>
        {succeeded && <p className="text-base text-zinc-700">ภาพ AI เป็นภาพจำลอง สีและขนาดอาจต่างจากสินค้าจริง{session.photoCount < session.items.length ? ' · สินค้าบางชิ้นจำลองจากชื่อสินค้าเพราะไม่มีภาพอ้างอิง' : ''}</p>}
        {saved && <p role="status" className="text-sm text-sage">บันทึกแบบและรายการสินค้าแล้ว ดาวน์โหลดเพื่อเก็บไฟล์ภาพไว้ด้วย</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </section>
      <aside className="space-y-4 rounded-2xl border border-[#e6dfd7] bg-white p-5">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">ของที่เลือก</h2><span className="text-base text-zinc-700">{session.items.length} ชิ้น</span></div>
        <ul className="space-y-4">{session.items.map(item => <li key={item.id} className="flex gap-3 border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
          <FurnitureImage item={item} className="size-20 shrink-0 rounded-xl" />
          <div className="min-w-0 space-y-1"><h3 className="line-clamp-2 text-base font-medium">{item.name}</h3><FurniturePrice item={item} /><a href={item.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center text-sm text-brand underline underline-offset-4">ดูใน Shopee ↗</a></div>
        </li>)}</ul>
        <div className="border-t border-zinc-200 pt-4"><BudgetSummary items={session.items} budget={session.plan.budget} /></div>
      </aside>
    </div>
    <Dialog open={outcomeOpen} onOpenChange={setOutcomeOpen}>
      <DialogContent closeLabel={succeeded ? 'ดูภาพห้อง' : 'ปิด'}>
        {succeeded ? <CheckCircle2 aria-hidden="true" className="mb-4 size-12 text-emerald-700" /> : <CircleAlert aria-hidden="true" className="mb-4 size-12 text-red-700" />}
        <DialogTitle className="text-2xl font-bold text-zinc-950">{succeeded ? 'สร้างภาพสำเร็จแล้ว' : session.job.status === 'cancelled' ? 'ยกเลิกการสร้างภาพแล้ว' : 'สร้างภาพไม่สำเร็จ'}</DialogTitle>
        <DialogDescription className="mt-3 text-base leading-7 text-zinc-800">{succeeded ? 'ภาพห้องพร้อมแล้ว คุณสามารถเทียบก่อน–หลัง บันทึก หรือดาวน์โหลดได้' : failureReason}</DialogDescription>
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-stone-100 p-4 text-zinc-900"><Clock3 className="size-6 shrink-0" /><div><p className="text-sm font-medium">เวลาที่ใช้</p><p className="text-xl font-bold tabular-nums">{duration}</p></div></div>
        {!succeeded && <><p className="mt-3 break-words text-sm text-zinc-700">รหัส: {session.job.error || session.job.status}</p><Button asChild className="mt-5 w-full"><Link href="/products">กลับไปเลือกสินค้าแล้วลองใหม่</Link></Button></>}
      </DialogContent>
    </Dialog>
  </div>
}
