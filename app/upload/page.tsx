'use client'
import {useCallback, useEffect, useRef, useState} from 'react'
import {ArrowRight, Camera, ImagePlus, Images, Trash2} from 'lucide-react'
import {ActionBar, PageHeader} from '@/components/page-header'
import {useRouter} from 'next/navigation'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {RemixBanner} from '@/components/remix-banner'
import {t} from '@/lib/copy'
import {BEFORE, DEFAULT_PLAN, ROOM_TYPES, STYLES, readPlan, roomName, savePlan, styleImage} from '@/lib/demo'
import {BudgetField} from '@/components/budget-field'
import {StyleReferenceInput} from '@/components/style-reference-input'
import {FloorPlanInput} from '@/components/floor-plan-input'
import {parseRoomArea} from '@/lib/floor-plan'
import {MAX_NEED_CHARS} from '@/lib/recommend-core'
import {MAX_ROOM_IMAGES, readRoomImages, saveRoomImages} from '@/lib/room-images'
import {IMAGE_ACCEPT, imageUploadError, isImageFile, resizeRoomImage} from '@/lib/image'
import {pickedFiles, pressProps, useFileDrop} from '@/lib/drop-zone'

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
  const [style, setStyle] = useState(DEFAULT_PLAN.style)
  const [budget, setBudget] = useState(String(DEFAULT_PLAN.budget))
  const [roomType, setRoomType] = useState(DEFAULT_PLAN.roomType)
  const [referenceBusy, setReferenceBusy] = useState(false)
  const [floorPlanBusy, setFloorPlanBusy] = useState(false)
  const [area, setArea] = useState('')
  const [need, setNeed] = useState('')

  useEffect(() => {
    setImages(readRoomImages())
    const plan = readPlan()
    setSample(!!plan.sample)
    setStyle(plan.style); setBudget(String(plan.budget)); setRoomType(plan.roomType)
    setArea(plan.areaM2 == null ? '' : String(plan.areaM2))
    setNeed(plan.need ?? '')
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
    if (files.some(file => !isImageFile(file))) { setError(t.invalidImage); return }
    choosing.current = true
    setBusy(true)
    try {
      const next = [...existing]
      for (const file of files) {
        const image = await resizeRoomImage(file, 1200)
        if (!next.includes(image)) next.push(image)
      }
      keep(next, false)
    } catch (error) { setError(imageUploadError(error)) } finally { setBusy(false); choosing.current = false }
  }, [images, sample, keep])

  const full = !sample && images.length >= MAX_ROOM_IMAGES
  const {dragging, dropProps} = useFileDrop({
    disabled: busy || full,
    onFiles: choose,
    onEmptyDrop: () => setError('กรุณาลากไฟล์รูปจากเครื่อง หรือคัดลอกรูปแล้วกด Cmd+V / Ctrl+V'),
  })

  const valid = Number(budget) > 0 && Number(budget) <= 1_000_000
  const roomArea = parseRoomArea(area)
  function next() {
    if (!preview || !valid || !roomArea.ok || busy || referenceBusy || floorPlanBusy) return
    if (!savePlan({style, budget: Number(budget), roomType, sample, areaM2: roomArea.value ?? null, need: need.trim()})) {
      setError('บันทึกข้อมูลไม่ได้ กรุณาลองใหม่'); return
    }
    router.push('/products')
  }

  return <div className="rl-flow">
    <RemixBanner />
    <PageHeader title="ห้องของคุณ สไตล์ของคุณ">เพิ่มรูป เลือกสไตล์ แล้วตั้งงบสำหรับหาของเข้าห้อง</PageHeader>
    <div className="grid items-start gap-6 lg:grid-cols-[.9fr_1.1fr] xl:gap-10">
      <div className="min-w-0 space-y-6">
      <section aria-labelledby="room-title" className="space-y-4">
        <h2 id="room-title" className="text-lg font-semibold">รูปห้อง <span className="text-sm font-normal text-zinc-500">(จำเป็น อย่างน้อย 1 รูป)</span></h2>
        <Card role="button" tabIndex={0} aria-label="เพิ่มรูปห้อง" aria-describedby="room-upload-help" aria-disabled={busy || full} aria-busy={busy}
          {...pressProps(() => { if (!busy && !full) gallery.current?.click() })} {...dropProps}
          className={`relative flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-2 lg:min-h-80 ${dragging ? 'border-brand bg-brand-soft' : 'bg-white'} ${busy || full ? 'cursor-default' : 'cursor-pointer hover:border-brand'}`}>
          {preview ? <img src={preview} alt="ภาพห้องหลัก" draggable={false} className="max-h-[50dvh] w-full rounded-xl object-contain" /> : <div className="space-y-2 p-6 text-center">
            <ImagePlus aria-hidden="true" className="mx-auto mb-3 size-9 text-brand" />
            <p className="font-semibold">เพิ่มรูปห้องของคุณ</p>
            <p className="text-sm text-zinc-500">คลิกเลือกรูป หรือลากมาวาง</p>
          </div>}
          {preview && sample && <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">ห้องตัวอย่าง</span>}
          {(dragging || busy) && <div role="status" className="absolute inset-0 flex items-center justify-center bg-white/85 font-semibold text-brand">{busy ? t.processing : 'ปล่อยเพื่อเพิ่มรูป'}</div>}
        </Card>
        <input ref={camera} type="file" accept={IMAGE_ACCEPT} capture="environment" className="hidden" onChange={e => void choose(pickedFiles(e))} />
        <input ref={gallery} type="file" multiple accept={IMAGE_ACCEPT} className="hidden" onChange={e => void choose(pickedFiles(e))} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy || full} onClick={() => gallery.current?.click()}><Images className="size-4" />เลือกรูป</Button>
          <Button variant="outline" disabled={busy || full} onClick={() => camera.current?.click()}><Camera className="size-4" />ถ่ายรูป</Button>
          <Button variant="ghost" disabled={busy} onClick={() => keep([BEFORE], true)}>ใช้ห้องตัวอย่าง</Button>
        </div>
        <p id="room-upload-help" className="text-sm text-zinc-500">{images.length}/4 รูป · เพิ่มมุมอื่นได้ · รูปแรกเป็นภาพหลัก</p>
        {images.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((src, i) => <div key={src} className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-2">
            {images.length > 1 && <img src={src} alt={`รูปห้อง ${i + 1}`} className="mb-2 aspect-[4/3] w-full rounded-lg object-cover" />}
            <button type="button" disabled={busy || i === 0} onClick={() => keep([src, ...images.filter((_, j) => j !== i)], sample)} className="min-h-11 w-full rounded-lg text-sm font-medium text-brand disabled:text-zinc-500">{i === 0 ? 'ภาพหลัก' : 'ใช้เป็นภาพหลัก'}</button>
            <button type="button" disabled={busy} aria-label={`ลบรูปที่ ${i + 1}`} onClick={() => keep(images.filter((_, j) => j !== i), sample)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm text-zinc-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" />ลบ</button>
          </div>)}
        </div>}
      </section>
      <div className="rounded-2xl border border-[#e6dfd7] bg-white p-4 sm:p-5"><FloorPlanInput onBusyChange={setFloorPlanBusy} /></div>
      <div className="space-y-2 rounded-2xl border border-[#e6dfd7] bg-white p-4 sm:p-5">
        <label htmlFor="room-area" className="block font-semibold">ขนาดห้อง <span className="text-sm font-normal text-zinc-500">(ไม่บังคับ)</span></label>
        <div className="relative"><input id="room-area" type="number" inputMode="decimal" min="0.01" max="10000" step="0.01" placeholder="เช่น 25" value={area} onChange={e => setArea(e.target.value)} aria-invalid={!roomArea.ok} aria-describedby="room-area-help" className="min-h-12 w-full rounded-xl border border-zinc-200 bg-paper py-3 pl-4 pr-20 text-base" /><span className="pointer-events-none absolute right-4 top-3 text-zinc-500">ตร.ม.</span></div>
        <p id="room-area-help" className={`text-sm ${roomArea.ok ? 'text-zinc-500' : 'text-red-700'}`}>{roomArea.ok ? 'ไม่ทราบขนาด เว้นว่างได้' : 'กรอกขนาดมากกว่า 0 ถึง 10,000 ตร.ม. (ทศนิยมไม่เกิน 2 ตำแหน่ง)'}</p>
      </div>
      </div>

      <section id="preferences" aria-labelledby="style-title" className="min-w-0 space-y-6">
        <div className="space-y-3">
          <h2 id="style-title" className="text-lg font-semibold">สไตล์ที่ชอบ</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STYLES.map(item => <button type="button" key={item.id} aria-pressed={style === item.id} onClick={() => setStyle(item.id)} className={`overflow-hidden rounded-xl border-2 text-left ${style === item.id ? 'border-brand bg-brand-soft' : 'border-transparent bg-white hover:border-brand/40'}`}>
              <img src={styleImage(item.id, 420)} alt="" className="aspect-[16/10] w-full object-cover" />
              <span className="flex min-h-14 items-center justify-between gap-1 p-2.5 text-sm font-medium">{item.name}<span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full ${style === item.id ? 'bg-brand text-white' : 'border border-zinc-300'}`}>{style === item.id ? '✓' : ''}</span></span>
            </button>)}
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-[#e6dfd7] bg-white p-4 sm:p-5">
          <label htmlFor="room-need" className="block text-lg font-semibold">อยากเพิ่มอะไรเป็นพิเศษ? <span className="text-sm font-normal text-zinc-600">(ไม่บังคับ)</span></label>
          <p id="room-need-help" className="text-sm leading-6 text-zinc-700">บอกการใช้งาน ของที่อยากได้ หรือของที่ไม่ต้องการ เพื่อช่วยเลือกสินค้า</p>
          <textarea id="room-need" maxLength={MAX_NEED_CHARS} value={need} onChange={e => setNeed(e.target.value)} aria-describedby="room-need-help room-need-count" placeholder="เช่น อยากได้โซฟา 2 ที่นั่ง มุมอ่านหนังสือ และที่เก็บของ ไม่เอาพรม" className="min-h-32 w-full resize-y rounded-xl border border-zinc-300 bg-paper p-3 text-base leading-7 text-zinc-900 placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
          <p id="room-need-count" className="text-right text-sm text-zinc-600">{need.length}/{MAX_NEED_CHARS} ตัวอักษร</p>
        </div>
        <div className="rounded-2xl border border-[#e6dfd7] bg-white p-4 sm:p-5">
            <fieldset><legend className="mb-3 text-base font-semibold">ประเภทห้อง</legend>
              <div className="flex flex-wrap gap-2">{ROOM_TYPES.map(type => <button key={type} type="button" aria-pressed={roomType === type} onClick={() => setRoomType(type)} className={`min-h-11 rounded-xl border px-4 text-sm ${roomType === type ? 'border-brand bg-brand text-white' : 'border-zinc-200'}`}>{roomName(type)}</button>)}</div>
            </fieldset>
        </div>
        <div className="rounded-2xl border border-[#e6dfd7] bg-white p-4 sm:p-5">
          <BudgetField value={budget} onChange={setBudget} />
        </div>
        <details className="rl-disclosure"><summary>เพิ่มภาพสไตล์ของคุณ (ไม่บังคับ)</summary><StyleReferenceInput onBusyChange={setReferenceBusy} /></details>
      </section>
    </div>
    {!valid && <p role="alert" className="text-sm text-red-700">กรอกงบ 1–1,000,000 บาท</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!preview && <p role="status" className="text-sm text-zinc-500">เพิ่มรูปห้องอย่างน้อย 1 รูปเพื่อไปต่อ</p>}
    <ActionBar><Button disabled={!preview || !valid || !roomArea.ok || busy || referenceBusy || floorPlanBusy} onClick={next}>หาของเข้าห้อง<ArrowRight className="size-4" /></Button></ActionBar>
  </div>
}
