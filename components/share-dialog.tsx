'use client'
import {useState} from 'react'
import Link from 'next/link'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger} from '@/components/ui/dialog'
import {BRAND, baht, fill, t} from '@/lib/copy'
import {BEFORE, SHOPEE_SEARCH, readSocial, roomName, styleImage, styleName, writeSocial, type FeedPost, type Plan} from '@/lib/demo'
import {isFixture} from '@/lib/fixtures'
import type {ExactListing} from '@/lib/listings'
import type {Product} from '@/lib/plan'

const priceLabel = (p: Product) => isFixture(p) ? `${t.shareFixture} ${baht(p.priceMax)}` : `${t.shareRange} ${baht(p.priceMin)}–${baht(p.priceMax)}`

/** ข้อความสรุปที่แชร์ได้: ไม่มีรูป ติดป้ายราคาตัวอย่าง/ช่วงประมาณ ลิงก์ค้นหาไม่ใช่ประกาศ ยกเว้นประกาศจริงที่ยืนยันแล้ว */
export function shareSummary(plan: Plan, items: Product[], exacts: ExactListing[], total: number) {
  return [
    fill(t.shareSummaryHead, {app: BRAND.name, room: roomName(plan.roomType), style: styleName(plan.style), budget: baht(plan.budget), width: plan.width, total: baht(total)}),
    ...items.map(p => `- ${p.name} · ${priceLabel(p)} · ${p.deeplink ? p.deeplink : `${t.shareSearch}: ${SHOPEE_SEARCH}${encodeURIComponent(p.keyword)}`}`),
    ...exacts.map(l => `- ${l.title} · ${t.shareExact} · ${l.url}`),
    t.shareFoot,
  ].join('\n')
}

// แชร์แบบผู้ใช้กดเองเท่านั้น และไม่มีเซิร์ฟเวอร์: โพสต์อยู่ใน localStorage เครื่องนี้
// รูปของผู้ใช้แนบเฉพาะตอนติ๊กเอง ค่าเริ่มต้นคือไม่แนบ
export function ShareDialog({plan, items, exacts, total, photo}: {plan: Plan; items: Product[]; exacts: ExactListing[]; total: number; photo: string | null}) {
  const [withPhoto, setWithPhoto] = useState(false)
  const [status, setStatus] = useState('')
  const [manual, setManual] = useState('')
  const text = shareSummary(plan, items, exacts, total)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  function post() {
    const social = readSocial()
    const base: FeedPost = {
      id: `local-${Date.now()}`, user: 'ฉัน', roomLabel: `${roomName(plan.roomType)} ${plan.width} ซม.`, style: plan.style, roomType: plan.roomType,
      budget: plan.budget, width: plan.width, before: BEFORE, after: styleImage(plan.style, 800), local: true,
      items: items.map(p => ({name: p.name, priceRange: isFixture(p) ? baht(p.priceMax) : `${baht(p.priceMin)}–${baht(p.priceMax)}`, keyword: p.keyword})),
    }
    const wantPhoto = withPhoto && photo
    if (writeSocial({...social, posts: [wantPhoto ? {...base, before: photo} : base, ...social.posts]})) setStatus(t.shared)
    else if (wantPhoto && writeSocial({...social, posts: [base, ...social.posts]})) setStatus(t.storageFull)
    else setStatus(t.imageError)
  }

  async function copy() {
    setManual('')
    try { await navigator.clipboard.writeText(text); setStatus(t.copied) }
    catch { setStatus(t.copyFailed); setManual(text) } // คลิปบอร์ดถูกบล็อก (เช่น http ที่ไม่ใช่ localhost) ให้คัดลอกเอง
  }

  return (
    <Dialog onOpenChange={() => { setStatus(''); setManual('') }}>
      <DialogTrigger asChild><Button variant="outline" className="w-full">{t.share}</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-lg font-bold">{t.shareTitle}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-zinc-600">{t.shareScope}</DialogDescription>
        {photo && (
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={withPhoto} onChange={e => setWithPhoto(e.target.checked)} className="mt-1 size-4 accent-[var(--color-brand)]" />
            {t.shareIncludePhoto}
          </label>
        )}
        <div className="mt-4 space-y-2">
          <Button className="w-full" onClick={post}>{t.shareConfirm}</Button>
          <Button variant="outline" className="w-full" onClick={copy}>{t.shareCopy}</Button>
          {canNativeShare && <Button variant="ghost" className="w-full" onClick={() => navigator.share({text}).catch(() => {})}>{t.shareNative}</Button>}
        </div>
        {status && <p role="status" className="mt-3 text-sm text-brand-dark">{status} {status === t.shared && <Link href="/" className="underline">{t.feedTitle}</Link>}</p>}
        {manual && <textarea readOnly value={manual} onFocus={e => e.currentTarget.select()} aria-label={t.shareCopy} className="mt-2 h-32 w-full rounded-xl border border-zinc-200 p-2 text-xs" />}
      </DialogContent>
    </Dialog>
  )
}
