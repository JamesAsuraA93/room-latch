'use client'
import {useEffect, useState} from 'react'
import {ActionBar, PageHeader} from '@/components/page-header'
import {useRouter} from 'next/navigation'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {RemixBanner} from '@/components/remix-banner'
import {StyleReferenceInput} from '@/components/style-reference-input'
import {t} from '@/lib/copy'
import {DEFAULT_PLAN, STYLES, readPlan, savePlan, styleImage} from '@/lib/demo'

export default function Style() {
  const router = useRouter()
  const [referenceBusy, setReferenceBusy] = useState(false)
  const [selected, setSelected] = useState(DEFAULT_PLAN.style)
  const [need, setNeed] = useState('')
  useEffect(() => { const p = readPlan(); setSelected(p.style); setNeed(p.need ?? '') }, [])
  return (
    <div className="flex min-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] flex-col gap-5">
      <RemixBanner />
      <PageHeader title={t.style}>{t.styleHint}</PageHeader>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {STYLES.map(item => (
          <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className="rl-room-choice rounded-[26px] text-left focus-visible:outline-2 focus-visible:outline-brand">
            <Card className={`overflow-hidden p-0 ${selected === item.id ? 'border-2 border-brand' : 'border-zinc-200'}`}>
              <img src={styleImage(item.id, 420)} alt={item.name} className="h-36 w-full object-cover md:h-40" />
              <div className="flex items-center justify-between p-4">
                <p className="text-sm font-medium">{item.name}</p>
                <span aria-hidden="true" className={`flex size-5 items-center justify-center rounded-full border ${selected === item.id ? 'border-brand bg-brand text-white' : 'border-zinc-200'}`}>{selected === item.id ? '✓' : ''}</span>
              </div>
            </Card>
          </button>
        ))}
      </div>
      <label className="block space-y-2 rounded-[26px] bg-white p-5">
        <span className="block text-sm font-semibold">อยากให้ห้องนี้ตอบโจทย์อะไรเป็นหลัก <span className="font-normal text-zinc-500">(ไม่บังคับ)</span></span>
        <textarea value={need} maxLength={300} rows={3} onChange={e => setNeed(e.target.value)}
          placeholder="เช่น อยากได้มุมนั่งอ่านหนังสือ มีที่เก็บของ หรือนั่งพื้นเป็นหลัก"
          className="w-full resize-none rounded-2xl border border-zinc-200 bg-paper p-3 text-sm focus-visible:outline-2 focus-visible:outline-brand" />
        <span className="block text-[11px] text-zinc-500">ใช้ช่วยเลือกสินค้าให้ตรงความต้องการ {need.length}/300</span>
      </label>
      <details className="rl-disclosure">
        <summary>มีภาพสไตล์ที่ชอบอยู่แล้ว? เพิ่มภาพอ้างอิง</summary>
        <StyleReferenceInput onBusyChange={setReferenceBusy} />
      </details>
      <ActionBar>
        <Button disabled={referenceBusy} className="w-full" onClick={() => { savePlan({style: selected, need: need.trim()}); router.push('/setup') }}>{t.confirmStyle}</Button>
      </ActionBar>
    </div>
  )
}
