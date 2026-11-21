'use client'
import {useEffect, useState} from 'react'
import {ActionBar, PageHeader} from '@/components/page-header'
import {useRouter} from 'next/navigation'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {RemixBanner} from '@/components/remix-banner'
import {t} from '@/lib/copy'
import {STYLES, readPlan, savePlan, styleImage} from '@/lib/demo'

export default function Style() {
  const router = useRouter()
  const [selected, setSelected] = useState<string>('japandi')
  useEffect(() => setSelected(readPlan().style), [])
  return (
    <div className="flex min-h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] flex-col gap-5">
      <RemixBanner />
      <PageHeader title={t.style}>{t.styleHint}</PageHeader>
      <div className="grid grid-cols-2 gap-3">
        {STYLES.map(item => (
          <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className="text-left">
            <Card className={`overflow-hidden p-0 ${selected === item.id ? 'border-2 border-brand' : 'border-zinc-200'}`}>
              <img src={styleImage(item.id, 420)} alt={item.name} className="h-32 w-full object-cover" />
              <p className="p-3 text-sm font-medium">{item.name}</p>
            </Card>
          </button>
        ))}
      </div>
      <ActionBar>
        <Button className="w-full" onClick={() => { savePlan({style: selected}); router.push('/setup') }}>{t.confirmStyle}</Button>
      </ActionBar>
    </div>
  )
}
