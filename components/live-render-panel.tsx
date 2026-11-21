'use client'
import {useEffect, useRef, useState} from 'react'
import {ReferenceFeedback} from '@/components/reference-feedback'
import {Button} from '@/components/ui/button'
import type {Provider} from '@/lib/live-render-core'

type Item = {id: string; x: number; y: number; w: number}
type Job = {id: string; status: 'running' | 'succeeded' | 'failed' | 'cancelled'; error?: string; finishedAt?: number; output?: {width: number; height: number}}

const NAME: Record<Provider, string> = {codex: 'Codex CLI บน Mac เครื่องนี้', openai: 'OpenAI Images API'}

// สร้างภาพ "หลัง" จริงด้วย AI (เฉพาะเครื่องที่เปิดไว้เท่านั้น) ต้องยินยอมก่อนส่งรูปห้อง
// ภาพซ้อนในเบราว์เซอร์ด้านบนยังเป็นเดโมเสมอ ส่วนนี้แสดงเฉพาะภาพที่สร้างเสร็จและตรวจแล้วจริง
export function LiveRenderPanel({provider, roomImage, roomImages = [], meta}: {provider: Provider; roomImage: string; roomImages?: string[]; meta: {styleId: string; roomType: string; budget: number; width: number; items: Item[]}}) {
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState('')
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (poll.current) clearTimeout(poll.current) }, [])

  async function watch(id: string) {
    const r = await fetch(`/api/render/live/${id}`, {cache: 'no-store'})
    if (!r.ok) { setError(`ตรวจสถานะไม่ได้ (${r.status})`); return }
    const {job: j} = await r.json() as {job: Job}
    setJob(j)
    if (j.status === 'running') poll.current = setTimeout(() => void watch(id), 3000)
  }

  async function generate() {
    setSubmitting(true)
    setError(''); setJob(null)
    try {
      const form = new FormData()
      for (const image of (roomImages.length ? roomImages : [roomImage])) {
        const blob = await (await fetch(image)).blob()
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) { setError('รูปห้องต้องเป็น jpg / png / webp'); return }
        form.append('image', blob, 'room')
      }
      form.append('meta', JSON.stringify(meta))
      form.append('consent', 'yes')
      const r = await fetch('/api/render/live', {method: 'POST', body: form})
      const body = await r.json().catch(() => ({}))
      if (!r.ok) { setError(`เริ่มไม่ได้: ${body?.error?.code ?? r.status}`); return }
      setJob(body.job)
      void watch(body.job.id)
    } catch { setError('ส่งคำขอไม่สำเร็จ') } finally { setSubmitting(false) }
  }

  const running = submitting || job?.status === 'running'
  return (
    <section className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">สร้างภาพหลังด้วย AI</h2>
        <span className="text-[11px] font-semibold text-brand">เฉพาะเครื่องนี้ · {NAME[provider]}</span>
      </div>
      <label className="flex items-start gap-2 text-xs text-zinc-700">
        <input type="checkbox" checked={consent} disabled={running} onChange={e => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-brand)]" />
        ยินยอมส่งภาพอ้างอิงทั้งหมด {roomImages.length || 1} รูปให้ {NAME[provider]} {provider === 'codex' ? '(ใช้บัญชีที่ล็อกอินไว้ ซึ่งส่งต่อไปที่ OpenAI)' : ''} เพื่อสร้างภาพ 1 ภาพ ไฟล์รูปห้องถูกลบหลังสร้างเสร็จ
      </label>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!consent || running} onClick={() => void generate()}>{running ? 'กำลังสร้างภาพ…' : 'สร้างภาพหลังด้วย AI'}</Button>
        {running && job && <Button variant="outline" onClick={() => void fetch(`/api/render/live/${job.id}`, {method: 'DELETE'}).then(() => watch(job.id))}>ยกเลิก</Button>}
      </div>
      {running && <p className="text-xs text-zinc-500">อาจใช้เวลาหลายนาที ภาพด้านบนยังเป็นเดโม (วางรูปในเบราว์เซอร์)</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {job && (job.status === 'failed' || job.status === 'cancelled') && (
        <p role="alert" className="text-sm text-red-700">ไม่ได้ภาพจาก AI ({job.error ?? job.status}) ภาพด้านบนยังเป็นเดโม ไม่ใช่ผลจาก AI</p>
      )}
      {job?.status === 'succeeded' && job.output && (
        <figure className="space-y-2">
          <ReferenceFeedback count={roomImages.length || 1} />
          <img src={`/api/render/live/${job.id}/image`} alt="ภาพหลังที่ AI สร้างจากรูปห้อง" className="w-full rounded-2xl" />
          <figcaption className="text-xs text-zinc-600">
            ภาพนี้สร้างจริงโดย {NAME[provider]} ({job.output.width}×{job.output.height}) เป็นภาพจำลอง ไม่ได้ยืนยันขนาดจริง ควรวัดพื้นที่ก่อนซื้อ
          </figcaption>
        </figure>
      )}
    </section>
  )
}
