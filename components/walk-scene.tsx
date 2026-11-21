'use client'
import {useCallback, useEffect, useRef, useState} from 'react'
import Link from 'next/link'
import {Footprints} from 'lucide-react'
import {Button} from '@/components/ui/button'

type Scene = {status: 'running' | 'succeeded' | 'failed'; step: string; error?: string | null}
const POLL_MS = 5000
const STEPS: Record<string, string> = {
  start: 'กำลังเริ่ม', outpaint: 'วาดห้องรอบตัวต่อจากภาพของคุณ', seam: 'เก็บรอยต่อ 360°', masks: 'หาตำแหน่งสินค้าแต่ละชิ้นในภาพ',
  depth: 'คำนวณความลึกของห้อง', standpoints: 'สร้างจุดยืนเพิ่มเพื่อเดินในห้อง', finish: 'เพิ่มความคมชัดและจัดเก็บฉาก',
}
const ERRORS: Record<string, string> = {
  scenes_disabled: 'เครื่องนี้ยังสร้างห้อง 360° ไม่ได้ (ต้องรันบนเครื่องที่มี pano360)',
  scene_in_progress: 'กำลังสร้างห้อง 360° ของงานอื่นอยู่ กรุณารอให้เสร็จก่อน',
  render_not_ready: 'ภาพผลลัพธ์ยังไม่พร้อม',
}

/** Build and open a 360° walkthrough of THIS render: same room, same products (front view = the render itself). */
export function WalkScene({jobId, productIds, before}: {jobId: string; productIds: string[]; before?: string}) {
  const [scene, setScene] = useState<Scene | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const poll = useCallback(async () => {
    clearTimeout(timer.current)
    try {
      const res = await fetch(`/api/scenes/${jobId}`, {cache: 'no-store'})
      if (res.status === 404) { setScene(null); return }
      const json = await res.json()
      setScene(json.scene)
      if (json.scene?.status === 'running') timer.current = setTimeout(() => void poll(), POLL_MS)
    } catch { timer.current = setTimeout(() => void poll(), POLL_MS * 2) }
  }, [jobId])
  useEffect(() => { void poll(); return () => clearTimeout(timer.current) }, [poll])

  async function start() {
    setStarting(true); setError('')
    try {
      const form = new FormData()
      form.append('job', jobId)
      form.append('products', JSON.stringify(productIds.filter(id => id.startsWith('shopee-')).slice(0, 6)))
      if (before?.startsWith('data:')) form.append('before', await (await fetch(before)).blob(), 'before.jpg')
      const res = await fetch('/api/scenes', {method: 'POST', body: form})
      const json = await res.json().catch(() => null)
      if (!res.ok) { setError(ERRORS[json?.error?.code] ?? `เริ่มสร้างไม่สำเร็จ (${json?.error?.code ?? res.status})`); return }
      setScene(json.scene)
      timer.current = setTimeout(() => void poll(), POLL_MS)
    } catch { setError('เชื่อมต่อไม่ได้ กรุณาลองใหม่') } finally { setStarting(false) }
  }

  if (scene?.status === 'succeeded') return <Button asChild><Link href={`/walk?scene=u-${jobId}`}><Footprints className="size-4" />เดินดูห้องนี้แบบ 360°</Link></Button>
  if (scene?.status === 'running') return <p role="status" className="flex min-h-10 items-center gap-2 text-sm text-zinc-600">
    <Footprints className="size-4 animate-pulse" />กำลังสร้างห้อง 360°: {STEPS[scene.step] ?? scene.step} (ใช้เวลาหลายนาที)
  </p>
  return <span className="flex flex-col gap-1">
    <Button variant="outline" disabled={starting} onClick={() => void start()}>
      <Footprints className="size-4" />{starting ? 'กำลังเริ่ม…' : scene?.status === 'failed' ? 'สร้างห้อง 360° ใหม่' : 'สร้างห้อง 360° จากภาพนี้'}
    </Button>
    {scene?.status === 'failed' && <span role="alert" className="text-xs text-red-700">สร้างห้อง 360° ไม่สำเร็จ ({scene.error ?? 'unknown'})</span>}
    {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
  </span>
}
