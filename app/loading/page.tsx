'use client'
import {useEffect, useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Button} from '@/components/ui/button'
import {Skeleton} from '@/components/ui/skeleton'
import {t} from '@/lib/copy'
import {readPlacement, readPlan, writeJson} from '@/lib/demo'
import {RENDER_KEY} from '@/lib/storage-keys'
const TIMEOUT_MS = 5000

// ส่งเฉพาะ metadata (สไตล์ ห้อง งบ ขนาด ตำแหน่งของ) ไป /api/render ไม่มีรูป
// เซิร์ฟเวอร์ตอบหรือไม่ตอบก็ไปหน้าผลลัพธ์ได้ (fail-soft) เพราะภาพหลังวางในเบราว์เซอร์อยู่แล้ว
export default function Loading() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const plan = readPlan()
    const pos = readPlacement().pos
    const items = Object.entries(pos).slice(0, 12).map(([id, p]) => ({id: id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80), x: p.x, y: p.y, w: p.w}))
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    let alive = true
    fetch('/api/render', {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: ctrl.signal,
      body: JSON.stringify({styleId: plan.style, roomType: plan.roomType, budget: plan.budget, width: plan.width, items})})
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then(d => writeJson('session', RENDER_KEY, {provider: d.provider, jobId: d.jobId, ok: true}))
      .catch(() => { writeJson('session', RENDER_KEY, {ok: false}); if (alive) setFailed(true) })
      .finally(() => { clearTimeout(timer); if (alive) router.replace('/result') })
    return () => { alive = false; clearTimeout(timer); ctrl.abort() }
  }, [router])
  return (
    <div className="flex min-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-2xl font-bold">{t.loading}</h1>
      <div className="relative flex size-40 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-[12px] border-zinc-100 border-t-brand motion-reduce:animate-none" />
        <span className="text-sm text-zinc-500">{t.wait}</span>
      </div>
      <p className="text-zinc-500">{t.generating}</p>
      <p className="text-xs text-zinc-500">{failed ? t.renderOffline : t.loadingSend}</p>
      <div className="w-full space-y-3">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
      <p className="text-xs text-zinc-500">{t.demoSkip}</p>
      <Button asChild className="w-full"><Link href="/result">{t.viewDemo}</Link></Button>
      <Button asChild variant="outline" className="w-full"><Link href="/setup">{t.cancel}</Link></Button>
    </div>
  )
}
