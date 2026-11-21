'use client'
import {useState} from 'react'
import Link from 'next/link'
import {Check, Share2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger} from '@/components/ui/dialog'
import type {DesignSession} from '@/lib/design-session'

export function ShareDesign({session}: {session: DesignSession}) {
  const [busy, setBusy] = useState(false)
  const [shared, setShared] = useState(false)
  const [error, setError] = useState('')
  const [signIn, setSignIn] = useState(false)
  const after = `/api/render/live/${session.job.id}/image`

  async function publish() {
    if (busy || shared || !session.before || session.job.status !== 'succeeded') return
    setBusy(true); setError(''); setSignIn(false)
    try {
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(session.before)) throw new Error('before_required')
      const before = await (await fetch(session.before)).blob()
      const form = new FormData()
      form.set('before', before, 'before.jpg')
      form.set('consent', 'publish-before-after')
      form.set('meta', JSON.stringify({style: session.plan.style, roomType: session.plan.roomType, budget: session.plan.budget, itemIds: session.items.map(p => p.id)}))
      const response = await fetch(`/api/designs/${session.job.id}/publish`, {method: 'POST', body: form, signal: AbortSignal.timeout(60000)})
      if (response.status === 401) { setSignIn(true); return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'publish_unavailable')
      setShared(true)
      window.dispatchEvent(new Event('roomlatch:feed-updated'))
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      setError(code === 'before_required' ? 'ไม่พบภาพก่อนแต่งของงานนี้ กรุณาเปิดผลลัพธ์จากเบราว์เซอร์ที่ใช้สร้างภาพ'
        : code === 'image_too_large' ? 'ภาพก่อนแต่งใหญ่เกินไป กรุณาใช้ภาพขนาดเล็กลง'
        : code === 'render_not_ready' ? 'ไม่พบภาพผลลัพธ์ที่พร้อมแชร์ ไฟล์อาจหมดอายุแล้ว'
        : 'แชร์ไม่สำเร็จ กรุณาลองใหม่ ภาพและผลลัพธ์ของคุณยังอยู่')
    } finally { setBusy(false) }
  }

  return <Dialog>
    <DialogTrigger asChild><Button variant="outline"><Share2 className="size-4" />แชร์ลงฟีด</Button></DialogTrigger>
    <DialogContent>
      <DialogTitle className="text-xl font-bold">แชร์ห้องของคุณ</DialogTitle>
      <DialogDescription className="mt-2 text-sm leading-6 text-zinc-700">ภาพก่อนแต่งและภาพผลลัพธ์จะปรากฏในฟีดสาธารณะ พร้อมชื่อบัญชีและสินค้าที่เลือก ภาพก่อนแต่งเป็นภาพต้นฉบับและอาจมีคนอยู่ในภาพ</DialogDescription>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[{label: 'ก่อนแต่ง', src: session.before}, {label: 'ผลลัพธ์', src: after}].map(photo => <figure key={photo.label}>
          {photo.src ? <img src={photo.src} alt={photo.label} className="aspect-[4/3] w-full rounded-xl bg-stone-100 object-contain" /> : <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-stone-100 text-sm">ไม่มีภาพก่อนแต่ง</div>}
          <figcaption className="mt-1 text-center text-sm font-medium">{photo.label}</figcaption>
        </figure>)}
      </div>
      {shared ? <div role="status" className="mt-4 space-y-3"><p className="flex items-center gap-2 font-semibold text-emerald-800"><Check className="size-5" />แชร์ภาพก่อน–หลังลงฟีดแล้ว</p><Button asChild className="w-full"><Link href={`/feed#design-${session.job.id}`}>ดูโพสต์ในฟีด</Link></Button></div>
        : <Button className="mt-4 w-full" onClick={() => void publish()} disabled={busy || !session.before}>{busy ? 'กำลังแชร์…' : 'เผยแพร่ภาพก่อน–หลัง'}</Button>}
      {!session.before && <p className="mt-3 text-sm text-amber-900">ต้องมีภาพก่อนแต่งของงานนี้เพื่อแชร์ภาพคู่กัน</p>}
      {signIn && <p role="status" className="mt-3 text-sm">กรุณา<Link href={`/login?next=${encodeURIComponent(`/result?job=${session.job.id}`)}`} className="mx-1 font-semibold text-brand underline">เข้าสู่ระบบ</Link>ระบบจะพากลับมาที่ผลลัพธ์เพื่อแชร์</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </DialogContent>
  </Dialog>
}
