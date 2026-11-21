'use client'
import {useCallback, useEffect, useRef, useState} from 'react'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {resizeRoomImage} from '@/lib/image'
import {readStyleReference, saveStyleReference} from '@/lib/style-reference'

export function StyleReferenceInput({onBusyChange}: {onBusyChange: (busy: boolean) => void}) {
  const input = useRef<HTMLInputElement>(null)
  const processing = useRef(false)
  const depth = useRef(0)
  const [image, setImage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setImage(readStyleReference()), [])

  const choose = useCallback(async (files: File[]) => {
    if (!files.length || processing.current) return
    setError('')
    if (files.length !== 1) { setError('เลือกภาพสไตล์อ้างอิงได้ครั้งละ 1 รูป'); return }
    if (!files[0].type.startsWith('image/')) { setError('กรุณาเลือกไฟล์รูปภาพ'); return }
    processing.current = true
    setBusy(true); onBusyChange(true)
    try {
      const next = await resizeRoomImage(files[0], 1200)
      if (!saveStyleReference(next)) throw new Error('storage')
      setImage(next)
    } catch { setError('บันทึกรูปไม่ได้ ลองใช้รูป JPG หรือ PNG ขนาดเล็กลง') }
    finally { processing.current = false; setBusy(false); onBusyChange(false) }
  }, [onBusyChange])

  useEffect(() => {
    function paste(e: ClipboardEvent) {
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return
      const data = e.clipboardData
      if (!data) return
      const files = Array.from(data.files)
      if (!files.length) for (const item of Array.from(data.items)) {
        const file = item.kind === 'file' ? item.getAsFile() : null
        if (file) files.push(file)
      }
      if (files.length) { e.preventDefault(); void choose(files) }
    }
    function preventNavigation(e: DragEvent) {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    window.addEventListener('paste', paste)
    window.addEventListener('dragover', preventNavigation)
    window.addEventListener('drop', preventNavigation)
    return () => {
      window.removeEventListener('paste', paste)
      window.removeEventListener('dragover', preventNavigation)
      window.removeEventListener('drop', preventNavigation)
    }
  }, [choose])

  return <section className="space-y-3" aria-labelledby="custom-reference-title">
    <div>
      <h2 id="custom-reference-title" className="font-semibold">ภาพสไตล์อ้างอิงของคุณ <span className="text-sm font-normal text-zinc-500">(ไม่บังคับ)</span></h2>
      <p id="custom-reference-help" className="mt-1 text-xs leading-relaxed text-zinc-500">เพิ่มภาพห้องที่ชอบ 1 รูป เพื่อให้ AI อ้างอิงโทนสี วัสดุ และบรรยากาศ ร่วมกับสไตล์ที่เลือก ไม่นับรวมรูปห้อง 4 รูป</p>
    </div>
    <Card role="button" tabIndex={0} aria-label="เพิ่มหรือเปลี่ยนภาพสไตล์อ้างอิง" aria-describedby="custom-reference-help" aria-disabled={busy} aria-busy={busy}
      onClick={() => { if (!processing.current) input.current?.click() }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!processing.current) input.current?.click() } }}
      onDragEnter={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); depth.current++; setDragging(true) } }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = busy ? 'none' : 'copy' }}
      onDragLeave={e => { e.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false) }}
      onDrop={e => { e.preventDefault(); depth.current = 0; setDragging(false); const files = Array.from(e.dataTransfer.files); if (!files.length) setError('ลากไฟล์รูปจากเครื่อง หรือคัดลอกรูปแล้วกด Cmd+V / Ctrl+V'); else void choose(files) }}
      className={`relative flex min-h-44 cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${dragging ? 'border-brand bg-brand-soft' : 'bg-zinc-50 hover:border-brand'}`}>
      {image ? <img src={image} alt="ภาพสไตล์อ้างอิงของคุณ" draggable={false} className="pointer-events-none max-h-64 w-full rounded-xl object-contain" /> : <div className="pointer-events-none space-y-2 text-center">
        <p className="text-sm font-semibold">ลากภาพสไตล์ที่ชอบมาวางที่นี่</p>
        <p className="text-xs text-zinc-500">คลิกเลือกไฟล์ หรือวางรูปด้วย Cmd+V / Ctrl+V</p>
      </div>}
      {(busy || dragging) && <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/85 text-sm font-semibold text-brand">{busy ? 'กำลังเตรียมรูป…' : 'ปล่อยเพื่อใช้เป็นภาพสไตล์อ้างอิง'}</div>}
    </Card>
    <input ref={input} type="file" accept="image/*" className="hidden" onChange={e => { void choose(Array.from(e.target.files || [])); e.target.value = '' }} />
    {image && <div className="flex items-center justify-between gap-2"><span className="text-xs text-zinc-500">แนบภาพสไตล์แล้ว · คลิกภาพเพื่อเปลี่ยน</span><Button variant="ghost" disabled={busy} onClick={() => { if (saveStyleReference('')) { setImage(''); setError('') } else setError('ลบรูปไม่สำเร็จ กรุณาลองอีกครั้ง') }}>ลบภาพอ้างอิง</Button></div>}
    <p className="text-xs text-zinc-500">ภาพนี้ใช้เมื่อกดสร้างภาพด้วย AI ภาพตัวอย่างแบบวางสินค้าไม่ใช้ภาพอ้างอิงนี้</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>
}
