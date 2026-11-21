'use client'
import {useRef, useState} from 'react'
import {resizeRoomImage} from '@/lib/image'
import {styleName} from '@/lib/demo'
import type {RealProduct} from '@/lib/real-catalog'
import {Button} from '@/components/ui/button'

type Hit = {id: string; title: string; url: string; category: string; price: number | null; score: number; source: 'db' | 'shopee'}
type Result = {category: string; style: string | null; source: 'db' | 'shopee' | 'none'; hits: Hit[]; added: string[]}
const MAX_SCORE = 3
const ERRORS: Record<string, string> = {
  image_search_disabled: 'เซิร์ฟเวอร์นี้ยังไม่ได้เปิดการค้นด้วยรูป',
  image_too_large: 'รูปใหญ่เกินไป กรุณาใช้รูปที่เล็กลง',
  image_not_jpeg_png_webp: 'รองรับเฉพาะรูป JPG, PNG หรือ WebP',
  decisions_failed: 'ระบบเทียบรูปไม่ตอบ กรุณาลองใหม่',
}
const SOURCE: Record<Result['source'], string> = {
  db: 'เจอในคลังสินค้าของเรา',
  shopee: 'ไม่เจอตัวที่เหมือนพอในคลัง จึงค้น Shopee และเก็บตัวที่เหมือนเข้าคลังให้แล้ว',
  none: 'ยังไม่เจอสินค้าที่เหมือนพอ ลองรูปที่เห็นสินค้าชัดขึ้น',
}

const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob()

// ค้นด้วยรูป: ส่งรูปสินค้าที่อยากได้ไปเทียบกับคลังของเราก่อน ไม่เจอค่อยค้น Shopee แล้วเก็บเข้าคลัง
// ผลที่เลือกจะกลายเป็นสินค้าจริงที่ใส่ในภาพ AI ได้ (id อยู่ใน DB จึงผ่าน allowlist ของ render)
export function ImageSearch({style, onPick}: {style: string; onPick: (p: RealProduct) => void}) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [picked, setPicked] = useState<string[]>([])

  async function search(file: File) {
    setError(''); setResult(null); setBusy(true)
    try {
      const image = await resizeRoomImage(file, 1024)
      setPreview(image)
      const form = new FormData()
      form.append('image', await dataUrlToBlob(image), 'product.jpg')
      form.append('style', style)
      const res = await fetch('/api/search/image', {method: 'POST', body: form})
      const json = await res.json().catch(() => null)
      if (!res.ok) { setError(ERRORS[json?.error?.code] ?? `ค้นไม่สำเร็จ (${json?.error?.code ?? res.status})`); return }
      setResult(json as Result)
    } catch { setError('อ่านรูปไม่ได้ กรุณาลองรูปอื่น') } finally { setBusy(false) }
  }

  function pick(h: Hit) {
    if (picked.includes(h.id)) return
    setPicked([...picked, h.id])
    onPick({id: h.id, title: h.title, category: h.category as RealProduct['category'], styles: result?.style ? [result.style] : [],
      url: h.url, verification: 'listing', dimensions: null, notes: 'ค้นด้วยรูป'})
  }

  return (
    <section className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4">
      <div>
        <h2 className="text-base font-bold">ค้นสินค้าด้วยรูป</h2>
        <p className="text-xs text-zinc-500">ใส่รูปของที่อยากได้ (เช่น โคมไฟที่เห็นในรูปห้องตัวอย่าง) ระบบหาในคลังของเราก่อน ถ้าไม่มีจะค้นใน Shopee ให้ แล้วเก็บเข้าคลัง</p>
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) search(f) }} />
      <Button variant="outline" className="w-full" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'กำลังเทียบรูปกับสินค้า…' : 'เลือกรูปสินค้า'}
      </Button>
      {preview && /* eslint-disable-next-line @next/next/no-img-element */
        <img src={preview} alt="รูปที่ใช้ค้น" className="h-28 w-auto rounded-xl object-contain" />}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {result && (
        <div className="space-y-2" role="status">
          <p className="text-xs text-zinc-500">{SOURCE[result.source]}{result.style ? ` · สไตล์ใกล้เคียง: ${styleName(result.style)}` : ''}</p>
          <ul className="space-y-2">
            {result.hits.map(h => (
              <li key={h.id} className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-3">
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block text-sm font-medium leading-snug">{h.title}</span>
                  <span className="flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">เหมือน {h.score.toFixed(1)}/{MAX_SCORE}</span>
                    <span>{h.source === 'db' ? 'จากคลัง' : 'ใหม่จาก Shopee'}</span>
                    {h.price !== null && <span>ราคาตอนค้น ฿{h.price.toLocaleString('th-TH')} (ยังไม่ยืนยัน)</span>}
                  </span>
                  <a href={h.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-xs font-semibold text-brand">เปิดประกาศใน Shopee ›</a>
                </span>
                <Button variant={picked.includes(h.id) ? 'ghost' : 'outline'} disabled={picked.includes(h.id)} onClick={() => pick(h)}>
                  {picked.includes(h.id) ? 'เลือกแล้ว' : 'ใส่ในภาพ AI'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
