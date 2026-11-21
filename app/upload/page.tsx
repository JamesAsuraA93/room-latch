'use client'
import {useCallback, useEffect, useRef, useState} from 'react'
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
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  // ถ้านำเข้ารูปห้องจริงไว้ที่ Feed (เฉพาะเครื่อง) ปุ่มรูปตัวอย่างจะใช้รูปนั้นแทนรูป stock
  const privateBefore = usePrivatePair().before

  useEffect(() => {
    setImages(readRoomImages())
    setSample(!!readPlan().sample)
  }, [])

  const keep = useCallback((next: string[], isSample: boolean) => {
    if (!saveRoomImages(next)) { setError(t.imageError); return }
    setError('')
    setImages(next)
    setSample(isSample)
    savePlan({sample: isSample})
  }, [])

  const choose = useCallback(async (files: File[]) => {
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
  }, [images, sample, keep])

  useEffect(() => {
    function paste(event: ClipboardEvent) {
      // Preserve normal paste behavior in any editable controls.
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return
      const data = event.clipboardData
      if (!data) return
      const files = Array.from(data.files)
      // Some browsers expose clipboard images only through DataTransferItem.
      if (!files.length) {
        for (const item of Array.from(data.items)) {
          if (item.kind === 'file') {
            const file = item.getAsFile()
            if (file) files.push(file)
          }
        }
      }
      if (!files.length) return
      event.preventDefault()
      void choose(files)
    }
    // Stop the browser from navigating away if a file misses the drop zone.
    function preventFileNavigation(event: DragEvent) {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    window.addEventListener('paste', paste)
    window.addEventListener('dragover', preventFileNavigation)
    window.addEventListener('drop', preventFileNavigation)
    return () => {
      window.removeEventListener('paste', paste)
      window.removeEventListener('dragover', preventFileNavigation)
      window.removeEventListener('drop', preventFileNavigation)
    }
  }, [choose])

  const full = !sample && images.length >= MAX_ROOM_IMAGES

  return (
    <div className="flex min-h-[calc(100dvh-19rem-env(safe-area-inset-bottom))] flex-col gap-5">
      <RemixBanner />
      <PageHeader title={t.upload}>เพิ่มภาพห้องจากหลายมุมหรือรูปแปลนห้องได้ รวมสูงสุด 4 รูป เลือกภาพห้องหลักสำหรับสร้างผลลัพธ์</PageHeader>
      <Card
        role="button"
        tabIndex={0}
        aria-label="เพิ่มรูปห้อง: คลิกเลือกไฟล์ ลากรูปมาวาง หรือกด Command V / Control V"
        aria-describedby="room-upload-help"
        aria-disabled={busy || full}
        aria-busy={busy}
        onClick={() => { if (!busy && !full) gallery.current?.click() }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!busy && !full) gallery.current?.click()
          }
        }}
        onDragEnter={e => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          dragDepth.current += 1
          if (!busy && !full) setDragging(true)
        }}
        onDragOver={e => {
          e.preventDefault()
          e.dataTransfer.dropEffect = busy || full ? 'none' : 'copy'
        }}
        onDragLeave={e => {
          e.preventDefault()
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (!dragDepth.current) setDragging(false)
        }}
        onDrop={e => {
          e.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          const files = Array.from(e.dataTransfer.files)
          if (!files.length) { setError('กรุณาลากไฟล์รูปจากเครื่อง หรือคัดลอกรูปแล้วกด Cmd+V / Ctrl+V'); return }
          void choose(files)
        }}
        className={`relative flex min-h-72 md:min-h-80 items-center justify-center overflow-hidden border-2 border-dashed p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${dragging ? 'border-brand bg-brand-soft' : 'bg-zinc-50'} ${busy || full ? 'cursor-default' : 'cursor-pointer hover:border-brand'}`}
      >
        {preview ? <img src={preview} draggable={false} alt={t.upload} className="pointer-events-none max-h-96 w-full rounded-2xl object-contain" /> : <div className="pointer-events-none space-y-2 px-4 text-center">
          <p className="font-semibold text-zinc-700">ลากรูปห้องมาวางที่นี่</p>
          <p className="text-sm text-zinc-500">หรือคลิกเลือกไฟล์ · วางรูปด้วย Cmd+V / Ctrl+V</p>
          <p className="text-xs text-zinc-500">ภาพห้องหรือแปลนห้อง รวมสูงสุด 4 รูป</p>
        </div>}
        {preview && sample && <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{t.sampleLabel}</span>}
        {(dragging || busy) && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/85 p-4 text-center font-semibold text-brand" role="status">{busy ? t.processing : 'ปล่อยเพื่อเพิ่มรูปห้อง'}</div>}
      </Card>
      <p id="room-upload-help" className="text-xs text-zinc-500">{full ? 'ครบ 4 รูปแล้ว ลบรูปเดิมก่อนเพิ่มรูปใหม่' : 'ลากไฟล์รูปลงในกรอบ หรือคัดลอกรูปแล้วกด Cmd+V (Mac) / Ctrl+V (Windows) บนหน้านี้'}</p>
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
      <button type="button" disabled={busy} onClick={() => { setError(''); keep([privateBefore?.url ?? BEFORE], true) }} className="flex items-center gap-4 rounded-[24px] bg-white p-3 text-left shadow-sm disabled:opacity-50">
        <img src={privateBefore?.url ?? BEFORE} alt="ห้องตัวอย่างสำหรับทดลอง" className="h-20 w-24 rounded-2xl object-cover" />
        <span className="flex-1"><span className="block text-sm font-semibold">ยังไม่มีรูปห้อง? ลองห้องนี้ได้เลย</span><span className="mt-1 block text-xs text-zinc-500">ใช้ภาพตัวอย่างเพื่อทดลองออกแบบ</span></span><span className="pr-2 text-xl text-brand" aria-hidden="true">↗</span>
      </button>
      <p className="text-xs leading-relaxed text-zinc-500">{t.privacy}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ActionBar>
        <Button disabled={busy || !preview} className="w-full" onClick={() => router.push('/style')}>{busy ? t.processing : t.next}</Button>
      </ActionBar>
    </div>
  )
}
