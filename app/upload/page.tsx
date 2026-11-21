'use client'
import {useEffect, useRef, useState} from 'react'
import {ActionBar, PageHeader} from '@/components/page-header'
import {useRouter} from 'next/navigation'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {RemixBanner} from '@/components/remix-banner'
import {t} from '@/lib/copy'
import {BEFORE, ROOM_IMAGE_KEY, readPlan, savePlan} from '@/lib/demo'
import {resizeRoomImage} from '@/lib/image'
import {usePrivatePair} from '@/lib/private-pair'

export default function Upload() {
  const router = useRouter()
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState('')
  const [sample, setSample] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // ถ้านำเข้ารูปห้องจริงไว้ที่ Feed (เฉพาะเครื่อง) ปุ่มรูปตัวอย่างจะใช้รูปนั้นแทนรูป stock
  const privateBefore = usePrivatePair().before

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ROOM_IMAGE_KEY)
      if (saved) { setPreview(saved); setSample(!!readPlan().sample) }
    } catch {}
  }, [])

  function keep(url: string, isSample: boolean) {
    setPreview(url)
    setSample(isSample)
    savePlan({sample: isSample})
    try { sessionStorage.setItem(ROOM_IMAGE_KEY, url) } catch { setError(t.imageError) }
  }

  async function choose(file?: File) {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) { setError(t.invalidImage); return }
    setBusy(true)
    try { keep(await resizeRoomImage(file), false) } catch { setError(t.imageError) } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] flex-col gap-5">
      <RemixBanner />
      <PageHeader title={t.upload}>{t.uploadHint}</PageHeader>
      <Card className="relative flex min-h-72 items-center justify-center overflow-hidden border-dashed bg-zinc-50 p-2">
        {preview ? <img src={preview} alt={t.upload} className="max-h-96 w-full rounded-2xl object-contain" /> : <p className="text-center text-zinc-400">{t.choosePhoto}</p>}
        {preview && sample && <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{t.sampleLabel}</span>}
      </Card>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { void choose(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={e => { void choose(e.target.files?.[0]); e.target.value = '' }} />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => camera.current?.click()}>{t.camera}</Button>
        <Button variant="outline" onClick={() => gallery.current?.click()}>{t.gallery}</Button>
      </div>
      <Button variant="ghost" className="w-full text-brand" onClick={() => { setError(''); keep(privateBefore?.url ?? BEFORE, true) }}>{privateBefore ? 'ใช้รูปห้องจริงที่นำเข้า (เครื่องนี้)' : t.useSample}</Button>
      <p className="text-xs leading-relaxed text-zinc-500">{t.privacy}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ActionBar>
        <Button disabled={busy || !preview} className="w-full" onClick={() => router.push('/style')}>{busy ? t.processing : t.next}</Button>
      </ActionBar>
    </div>
  )
}
