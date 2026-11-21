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
  useEffect(() => setSelected(readPlan().style), [])
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
      <details className="rl-disclosure">
        <summary>มีภาพสไตล์ที่ชอบอยู่แล้ว? เพิ่มภาพอ้างอิง</summary>
        <StyleReferenceInput onBusyChange={setReferenceBusy} />
      </details>
      <ActionBar>
        <Button disabled={referenceBusy} className="w-full" onClick={() => { savePlan({style: selected}); router.push('/setup') }}>{t.confirmStyle}</Button>
      </ActionBar>
    </div>
  )
}
