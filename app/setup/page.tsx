'use client'
import {useEffect, useState} from 'react'
import {ActionBar, PageHeader} from '@/components/page-header'
import {useRouter} from 'next/navigation'
import {Button} from '@/components/ui/button'
import {NumberField} from '@/components/number-field'
import {RemixBanner} from '@/components/remix-banner'
import {t} from '@/lib/copy'
import {BUDGET_PRESETS, DEFAULT_PLAN, ROOM_TYPES, WIDTH_PRESETS, readPlacement, readPlan, roomName, savePlan, writePlacement} from '@/lib/demo'

export default function Setup() {
  const router = useRouter()
  const [roomType, setRoomType] = useState(DEFAULT_PLAN.roomType)
  const [budget, setBudget] = useState(String(DEFAULT_PLAN.budget))
  const [width, setWidth] = useState(String(DEFAULT_PLAN.width))
  useEffect(() => {
    const p = readPlan()
    setRoomType(p.roomType); setBudget(String(p.budget)); setWidth(String(p.width))
  }, [])
  const valid = Number(budget) > 0 && Number(width) > 0
  return (
    <div className="flex min-h-[calc(100dvh-19rem-env(safe-area-inset-bottom))] flex-col gap-5">
      <RemixBanner />
      <PageHeader title={t.setup}>{t.setupHint}</PageHeader>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">{t.roomType}</legend>
        <div className="flex flex-wrap gap-2">
          {ROOM_TYPES.map(r => (
            <button key={r} type="button" aria-pressed={roomType === r} onClick={() => setRoomType(r)}
              className={`min-h-10 rounded-full border px-4 text-sm ${roomType === r ? 'border-brand bg-brand text-white' : 'border-zinc-200 bg-white text-ink'}`}>
              {roomName(r)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[26px] bg-white p-6">
          <NumberField label={t.budget} value={budget} onChange={setBudget} presets={BUDGET_PRESETS} />
        </div>
        <div className="rounded-[26px] bg-white p-6">
          <NumberField label={t.width} hint={t.widthHint} value={width} onChange={setWidth} presets={WIDTH_PRESETS} />
        </div>
      </div>
      {!valid && <p role="alert" className="text-sm text-red-700">{t.invalidNumber}</p>}
      <ActionBar>
        <Button disabled={!valid} className="w-full" onClick={() => { savePlan({roomType, budget: Number(budget), width: Number(width)}); writePlacement({...readPlacement(), set: undefined}); router.push('/loading') }}>{t.seeSet}</Button>
      </ActionBar>
    </div>
  )
}
