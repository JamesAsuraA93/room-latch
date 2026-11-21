'use client'
import {useEffect, useRef, useState} from 'react'
import Link from 'next/link'
import {ArrowDownToLine, ImagePlus, Plus, Sparkles, Trash2} from 'lucide-react'
import {readStyleReference} from '@/lib/style-reference'
import {resizeRoomImage} from '@/lib/image'
import {Button} from '@/components/ui/button'
import type {Provider} from '@/lib/live-render-core'
import {MAX_PRODUCT_IMAGES} from '@/lib/product-render'

type Item = {id: string; x: number; y: number; w: number}
export type ProductPhotoOption = {id: string; name: string; image?: string; widthCm?: number}
type AttachedProduct = ProductPhotoOption & {image: string}
type Job = {id: string; status: 'running' | 'succeeded' | 'failed' | 'cancelled'; error?: string; output?: {width: number; height: number}}
const STORAGE_KEY = 'room-ai-product-render'
const ERRORS: Record<string, string> = {
  live_render_disabled: 'กรอก OPENAI_API_KEY ใน .env.local แล้วรีสตาร์ตเซิร์ฟเวอร์ก่อนสร้างภาพ',
  openai_auth: 'API key ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจ OPENAI_API_KEY',
  openai_access: 'บัญชีนี้ยังเข้าใช้โมเดลภาพไม่ได้ กรุณาตรวจสิทธิ์โมเดลและการยืนยันบัญชี OpenAI',
  openai_quota: 'วงเงิน API ไม่เพียงพอหรือส่งคำขอถี่เกินไป กรุณาตรวจ Billing แล้วลองอีกครั้ง',
  openai_failed: 'OpenAI สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง',
  openai_bad_response: 'ไม่ได้รับไฟล์ภาพที่ถูกต้องจาก OpenAI',
  job_in_progress: 'มีภาพกำลังสร้างอยู่ กรุณารอให้เสร็จก่อน',
  body_too_large: 'รูปทั้งหมดมีขนาดใหญ่เกินไป กรุณาลดขนาดรูป',
  timeout: 'ใช้เวลานานเกินกำหนด กรุณาลองใหม่',
  cancelled: 'ยกเลิกการสร้างภาพแล้ว',
}
const errorText = (code: string) => ERRORS[code] || `ไม่สามารถสร้างภาพได้ (${code})`

export function LiveRenderPanel({provider, ready = true, roomImage, roomImages = [], products = [], meta}: {
  provider: Provider; ready?: boolean; roomImage: string; roomImages?: string[]; products?: ProductPhotoOption[];
  meta: {styleId: string; roomType: string; budget: number; width: number; items: Item[]}
}) {
  const [attached, setAttached] = useState<AttachedProduct[]>([])
  const [styleReference, setStyleReference] = useState('')
  const [consent, setConsent] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [view, setView] = useState<'before' | 'after'>('before')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const chooser = useRef<HTMLInputElement>(null)
  const target = useRef<ProductPhotoOption | null>(null)
  const preparingRef = useRef(false)
  const sendingRef = useRef(false)
  const mounted = useRef(true)
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null)
  const running = submitting || job?.status === 'running'

  useEffect(() => {
    mounted.current = true
    setStyleReference(readStyleReference())
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
      if (Array.isArray(saved)) setAttached(saved.filter((p): p is AttachedProduct => !!p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.image === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(p.image)).slice(0, MAX_PRODUCT_IMAGES))
    } catch {}
    return () => { mounted.current = false; if (poll.current) clearTimeout(poll.current) }
  }, [])
  useEffect(() => { setConsent(false) }, [roomImage, attached, styleReference])

  function update(next: AttachedProduct[]) {
    setAttached(next); setNotice('')
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
    catch { setNotice('พื้นที่เบราว์เซอร์เต็ม รูปยังใช้สร้างภาพได้ในหน้านี้ แต่จะไม่อยู่หลังรีเฟรช') }
  }
  async function addFiles(files: File[], option: ProductPhotoOption | null = null) {
    if (!files.length || preparingRef.current || sendingRef.current || running) return
    setError('')
    if (option && files.length !== 1) { setError('เพิ่มรูปสินค้าได้ครั้งละ 1 รูปต่อชิ้น'); return }
    const base = option ? attached.filter(p => p.id !== option.id) : attached
    if (base.length + files.length > MAX_PRODUCT_IMAGES) { setError('เลือกสินค้าได้สูงสุด 6 ชิ้นต่อภาพ'); return }
    if (files.some(f => !f.type.startsWith('image/'))) { setError('กรุณาใช้ไฟล์รูปภาพ JPG, PNG หรือ WebP'); return }
    preparingRef.current = true; setPreparing(true)
    try {
      const added: AttachedProduct[] = []
      for (const [i, file] of files.entries()) {
        const image = await resizeRoomImage(file, 1200)
        added.push({...option, id: option?.id || `custom-photo-${crypto.randomUUID()}`, name: option?.name || `สินค้าของฉัน ${base.length + i + 1}`, image})
      }
      update([...base, ...added])
    } catch { setError('อ่านรูปไม่ได้ กรุณาลองไฟล์รูปอื่น') }
    finally { preparingRef.current = false; setPreparing(false) }
  }
  async function watch(id: string) {
    try {
      const r = await fetch(`/api/render/live/${id}`, {cache:'no-store', signal: AbortSignal.timeout(15000)})
      if (!r.ok) throw new Error('status')
      const {job: next} = await r.json() as {job: Job}
      if (!mounted.current) return
      setError('')
      setJob(next)
      if (next.status === 'succeeded') setView('after')
      if (next.status === 'running') poll.current = setTimeout(() => void watch(id), 2500)
    } catch {
      if (!mounted.current) return
      setError('ตรวจสถานะไม่ได้ ระบบจะลองตรวจใหม่โดยไม่ส่งงานสร้างภาพซ้ำ')
      poll.current = setTimeout(() => void watch(id), 5000)
    }
  }
  async function generate() {
    if (!ready || !consent || !attached.length || preparingRef.current || sendingRef.current || running) return
    sendingRef.current = true; setSubmitting(true); setError('')
    if (poll.current) clearTimeout(poll.current)
    setJob(null); setView('before')
    try {
      const form = new FormData()
      for (const image of (roomImages.length ? roomImages : [roomImage])) {
        const response = await fetch(image)
        if (!response.ok) throw new Error('อ่านรูปห้องไม่ได้ กรุณาอัปโหลดรูปห้องอีกครั้ง')
        const blob = await response.blob()
        if (!['image/jpeg','image/png','image/webp'].includes(blob.type)) throw new Error('รูปห้องต้องเป็น JPG, PNG หรือ WebP')
        form.append('image', blob, 'room')
      }
      for (const product of attached) form.append('productImage', await (await fetch(product.image)).blob(), `${product.id}.jpg`)
      if (styleReference) form.append('styleReference', await (await fetch(styleReference)).blob(), 'style-reference.jpg')
      form.append('productMeta', JSON.stringify(attached.map(({id,name,widthCm}) => ({id,name,widthCm}))))
      form.append('meta', JSON.stringify({...meta, items: attached.map(p => meta.items.find(i => i.id === p.id) || {id:p.id,x:0,y:0,w:0})}))
      form.append('consent', 'yes')
      const r = await fetch('/api/render/live', {method:'POST', body:form})
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(errorText(body?.error?.code || String(r.status)))
      setJob(body.job); void watch(body.job.id)
    } catch (e) { setError(e instanceof Error ? e.message : 'ส่งคำขอไม่สำเร็จ') }
    finally { sendingRef.current = false; setSubmitting(false) }
  }
  const output = job?.status === 'succeeded' && job.output ? `/api/render/live/${job.id}/image` : null
  return <section className="grid items-start gap-5 lg:grid-cols-[1.25fr_1fr]" aria-label="สร้างภาพห้องด้วยสินค้าจริง">
    <div className="space-y-4 lg:sticky lg:top-5">
      <div className="overflow-hidden rounded-[28px] bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1"><h2 className="text-sm font-semibold">{view === 'after' && output ? 'ภาพจำลองจาก AI' : 'ห้องของคุณ'}</h2><div className="flex rounded-full bg-paper p-1"><button type="button" aria-pressed={view === 'before'} onClick={()=>setView('before')} className={`rounded-full px-4 py-2 text-xs ${view==='before'?'bg-white shadow-sm':''}`}>ก่อน</button><button type="button" disabled={!output} aria-pressed={view === 'after'} onClick={()=>setView('after')} className={`rounded-full px-4 py-2 text-xs disabled:opacity-40 ${view==='after'?'bg-white shadow-sm':''}`}>หลัง</button></div></div>
        <div className="relative overflow-hidden rounded-[22px] bg-[#e9e2d9]"><img src={view==='after' && output ? output : roomImage} alt={view==='after' && output ? 'ภาพห้องที่ AI จำลองสินค้าจากรูปจริง' : 'ภาพห้องต้นฉบับ'} className="aspect-[4/3] w-full object-contain" />{running && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85"><Sparkles className="size-8 animate-pulse text-brand motion-reduce:animate-none" /><p className="font-semibold">กำลังจำลองสินค้าในห้อง…</p><p className="text-xs text-zinc-500">อาจใช้เวลาหลายนาที</p></div>}</div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-3"><Link href="/upload" className="inline-flex min-h-10 items-center gap-2 text-xs text-brand"><ImagePlus className="size-4" />เปลี่ยนรูปห้อง</Link>{output && <a href={output} download="roomlatch-room.png" className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-brand"><ArrowDownToLine className="size-4" />ดาวน์โหลดภาพ</a>}</div>
      </div>
      <div className="flex gap-2 overflow-x-auto">{roomImages.slice(1).map((src,i)=><img key={i} src={src} alt={`มุมห้องอ้างอิง ${i+2}`} className="h-16 w-20 rounded-xl object-cover" />)}{styleReference && <figure className="shrink-0"><img src={styleReference} alt="ภาพสไตล์อ้างอิง" className="h-16 w-20 rounded-xl object-cover" /><figcaption className="mt-1 text-[10px] text-zinc-500">สไตล์อ้างอิง</figcaption></figure>}</div>
      <p className="text-xs leading-6 text-zinc-500">AI ใช้รูปสินค้าที่คุณแนบเพื่อจำลองรูปทรง สี และวัสดุในห้อง ภาพอาจคลาดเคลื่อนจากสินค้าหรือขนาดจริง</p>
    </div>
    <div className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><div><p className="rl-section-label">PRODUCTS IN YOUR ROOM</p><h2 className="mt-2 text-lg font-semibold">นำสินค้าจริงมาลองวาง</h2></div><span className="rounded-full bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">{attached.length}/6</span></div>
      <p className="text-xs leading-6 text-zinc-500">แนบรูปสินค้าที่เห็นตัวชิ้นชัด ๆ ระบบส่งเฉพาะสินค้าที่มีรูปด้านล่างให้ AI</p>
      <div role="button" tabIndex={0} aria-label="เพิ่มรูปสินค้าจริง ลากวาง คลิก หรือวางรูปจากคลิปบอร์ด" aria-disabled={running || preparing || attached.length>=6}
        onClick={()=>{if (!running && !preparing && attached.length<6) {target.current=null;chooser.current?.click()}}}
        onKeyDown={e=>{if (e.key==='Enter'||e.key===' ') {e.preventDefault();if(!running&&!preparing&&attached.length<6){target.current=null;chooser.current?.click()}}}}
        onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect=running?'none':'copy';setDragging(true)}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);void addFiles(Array.from(e.dataTransfer.files))}}
        onPaste={e=>{const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();void addFiles(files)}}}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center focus-visible:outline-2 focus-visible:outline-brand ${dragging?'border-brand bg-brand-soft':'border-[#ded4c9] bg-paper'}`}>
        <ImagePlus className="mx-auto mb-2 size-6 text-brand" /><p className="text-sm font-semibold">{preparing?'กำลังเตรียมรูป…':attached.length>=6?'ครบ 6 ชิ้นแล้ว':'ลากรูปสินค้ามาวาง หรือคลิกเพิ่มรูป'}</p><p className="mt-2 text-[11px] text-zinc-500">คลิกกรอบแล้ว Cmd+V / Ctrl+V เพื่อวางรูป</p>
      </div>
      <input ref={chooser} type="file" accept="image/*" multiple className="hidden" onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';void addFiles(files,target.current);target.current=null}} />
      <div className="space-y-3">{attached.map((p,i)=><div key={p.id} className="flex gap-3 rounded-2xl border border-[#ece6df] p-3">
        <button type="button" disabled={running||preparing} aria-label={`เปลี่ยนรูป ${p.name}`} onClick={()=>{target.current=p;chooser.current?.click()}} className="shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-brand"><img src={p.image} alt={p.name} className="size-20 rounded-xl bg-paper object-contain" /></button>
        <div className="min-w-0 flex-1"><label className="block text-[10px] text-zinc-500" htmlFor={`product-name-${i}`}>สินค้า {i+1}</label><input id={`product-name-${i}`} value={p.name} maxLength={160} disabled={running||preparing||!p.id.startsWith('custom-')} onChange={e=>update(attached.map(item=>item.id===p.id?{...item,name:e.target.value}:item))} className="mt-1 w-full rounded-lg bg-paper p-2 text-xs disabled:bg-transparent disabled:opacity-100" /><label className="mt-2 flex items-center gap-2 text-[10px] text-zinc-500">กว้าง (ซม.)<input aria-label={`ความกว้าง ${p.name}`} type="number" min={1} max={1000} disabled={running||preparing} value={p.widthCm??''} onChange={e=>update(attached.map(item=>item.id===p.id?{...item,widthCm:e.target.value?Number(e.target.value):undefined}:item))} placeholder="ถ้าทราบ" className="w-20 rounded-lg border border-zinc-200 px-2 py-1.5" /></label></div>
        <button type="button" disabled={running||preparing} aria-label={`ลบสินค้า ${p.name}`} onClick={()=>update(attached.filter(item=>item.id!==p.id))} className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>
      </div>)}</div>
      {products.length>0 && <details className="rounded-2xl bg-paper p-3"><summary className="text-xs font-semibold">เพิ่มรูปให้สินค้าจากชุดแนะนำ</summary><div className="mt-3 space-y-2">{products.filter(p=>!attached.some(a=>a.id===p.id)).map(p=><button key={p.id} type="button" disabled={running||preparing||attached.length>=6} onClick={()=>{if(p.image){update([...attached,{...p,image:p.image}]);}else{target.current=p;chooser.current?.click()}}} className="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-left text-xs disabled:opacity-40"><span>{p.name.replace(' (fixture)','')}</span><Plus className="size-4 shrink-0 text-brand" /></button>)}</div></details>}
      {!ready && <p role="status" className="rounded-2xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">พร้อมเตรียมรูปแล้ว · ใส่ OPENAI_API_KEY ใน .env.local แล้วรีสตาร์ตเซิร์ฟเวอร์เพื่อเริ่มสร้างภาพ</p>}
      <label className="flex items-start gap-2 text-xs leading-6 text-zinc-600"><input type="checkbox" checked={consent} disabled={running||preparing} onChange={e=>setConsent(e.target.checked)} className="mt-1.5 size-4 shrink-0 accent-[var(--color-brand)]" /><span>ยินยอมส่งรูปห้อง {roomImages.length||1} รูป + รูปสินค้า {attached.length} รูป{styleReference?' + ภาพสไตล์ 1 รูป':''} ให้ OpenAI เพื่อสร้างภาพ มีค่าใช้จ่ายตามการใช้งาน API</span></label>
      <Button className="w-full" disabled={!ready||!consent||!attached.length||attached.some(p=>!p.name.trim()||(p.widthCm!==undefined&&(!Number.isFinite(p.widthCm)||p.widthCm<=0||p.widthCm>1000)))||preparing||running} onClick={()=>void generate()}><Sparkles className="size-4" />{running?'กำลังสร้างภาพ…':'สร้างภาพห้องพร้อมสินค้าจริง'}</Button>
      {running && job && <Button variant="outline" className="w-full" onClick={()=>void fetch(`/api/render/live/${job.id}`,{method:'DELETE'}).then(r=>{if(!r.ok)throw new Error();return watch(job.id)}).catch(()=>setError('ยกเลิกไม่สำเร็จ กรุณาลองอีกครั้ง'))}>ยกเลิกการสร้าง</Button>}
      {notice && <p role="status" className="text-xs text-zinc-500">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {job && ['failed','cancelled'].includes(job.status) && <p role="alert" className="text-sm text-red-700">{errorText(job.error||job.status)}</p>}
      <p className="text-[10px] text-zinc-400">{provider==='openai'?'OpenAI Images API':'Codex'} · สร้างครั้งละ 1 ภาพ</p>
    </div>
  </section>
}
