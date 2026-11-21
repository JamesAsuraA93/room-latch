'use client'
import {useEffect, useRef, useState} from 'react'
import {ActionBar, PageHeader} from '@/components/page-header'
import {useRouter} from 'next/navigation'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {RemixBanner} from '@/components/remix-banner'
import {t} from '@/lib/copy'
import {BEFORE, readPlan, savePlan} from '@/lib/demo'
import {MAX_ROOM_IMAGES, readRoomImages, saveRoomImages} from '@/lib/room-images'
import {resizeRoomImage} from '@/lib/image'
import {usePrivatePair} from '@/lib/private-pair'

export default function Upload() {
  const router = useRouter()
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<string[]>([])
  const preview = images[0] || ''
  const choosing = useRef(false)
  const [sample, setSample] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // ถ้านำเข้ารูปห้องจริงไว้ที่ Feed (เฉพาะเครื่อง) ปุ่มรูปตัวอย่างจะใช้รูปนั้นแทนรูป stock
  const privateBefore = usePrivatePair().before

  useEffect(() => {
    setImages(readRoomImages())
    setSample(!!readPlan().sample)
  }, [])

  function keep(next: string[], isSample: boolean) {
    if (!saveRoomImages(next)) { setError(t.imageError); return }
    setImages(next)
    setSample(isSample)
    savePlan({sample: isSample})
  }

  async function choose(files: File[]) {
    if (!files.length || choosing.current) return
    setError('')
    const existing = sample ? [] : images
    if (existing.length + files.length > MAX_ROOM_IMAGES) { setError('เพิ่มได้สูงสุด 4 รูป กรุณาลบรูปเดิมหรือเลือกรูปให้น้อยลง'); return }
    if (files.some(file => !file.type.startsWith('image/'))) { setError(t.invalidImage); return }
    choosing.current = true
    setBusy(true)
    try {
      const next = [...existing]
      for (const file of files) {
        const image = await resizeRoomImage(file, 1200)
        if (!next.includes(image)) next.push(image)
      }
      keep(next, false)
    } catch { setError(t.imageError) } finally { setBusy(false); choosing.current = false }
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] flex-col gap-5">
      <RemixBanner />
      <PageHeader title={t.upload}>เพิ่มภาพห้องจากหลายมุมหรือรูปแปลนห้องได้ รวมสูงสุด 4 รูป เลือกภาพห้องหลักสำหรับสร้างผลลัพธ์</PageHeader>
      <Card className="relative flex min-h-72 items-center justify-center overflow-hidden border-dashed bg-zinc-50 p-2">
        {preview ? <img src={preview} alt={t.upload} className="max-h-96 w-full rounded-2xl object-contain" /> : <p className="text-center text-zinc-400">{t.choosePhoto}</p>}
        {preview && sample && <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{t.sampleLabel}</span>}
      </Card>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { void choose(Array.from(e.target.files || [])); e.target.value = '' }} />
      <input ref={gallery} type="file" multiple accept="image/*" className="hidden" onChange={e => { void choose(Array.from(e.target.files || [])); e.target.value = '' }} />
      <p role="status" className="text-sm text-zinc-600">{images.length}/4 รูป · รูปแรกคือภาพห้องหลัก</p>
      <div className="grid grid-cols-2 gap-3">
        {images.map((src, i) => <div key={src} className="space-y-2 rounded-2xl border p-2">
          <img src={src} alt={`ภาพอ้างอิง ${i + 1}`} className="h-28 w-full rounded-xl object-contain" />
          <Button variant="outline" disabled={busy || i === 0} onClick={() => keep([src, ...images.filter((_, j) => j !== i)], sample)}>{i === 0 ? 'ภาพหลัก' : 'ใช้เป็นภาพหลัก'}</Button>
          <Button variant="ghost" disabled={busy} aria-label={`ลบรูปที่ ${i + 1}`} onClick={() => keep(images.filter((_, j) => j !== i), sample)}>ลบรูป</Button>
        </div>)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" disabled={busy || (!sample && images.length >= 4)} onClick={() => camera.current?.click()}>{t.camera}</Button>
        <Button variant="outline" disabled={busy || (!sample && images.length >= 4)} onClick={() => gallery.current?.click()}>{t.gallery}</Button>
      </div>
      <Button variant="ghost" disabled={busy} className="w-full text-brand" onClick={() => { setError(''); keep([privateBefore?.url ?? BEFORE], true) }}>{privateBefore ? 'ใช้รูปห้องจริงที่นำเข้า (เครื่องนี้)' : t.useSample}</Button>
      <p className="text-xs leading-relaxed text-zinc-500">{t.privacy}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ActionBar>
        <Button disabled={busy || !preview} className="w-full" onClick={() => router.push('/style')}>{busy ? t.processing : t.next}</Button>
      </ActionBar>
    </div>
  )
}
