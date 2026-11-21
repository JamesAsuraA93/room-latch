'use client'

import {ArrowUpRight} from 'lucide-react'
import {useRouter} from 'next/navigation'
import {savePlan, styleImage, styleName} from '@/lib/demo'

export function StyleInspiration({id}: {id: string}) {
  const router = useRouter()
  return <button type="button" onClick={() => {
    savePlan({style: id, remixOf: undefined})
    router.push('/upload')
  }} className="rl-room-choice overflow-hidden rounded-2xl border border-[#e6dfd7] bg-white text-left">
    <img src={styleImage(id, 600)} alt={`ห้องตัวอย่างสไตล์${styleName(id)}`} loading="lazy" className="aspect-[3/2] w-full object-cover" />
    <span className="flex min-h-14 items-center justify-between gap-2 px-4 py-3">
      <span className="text-sm font-semibold sm:text-base">{styleName(id)}</span>
      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-brand" />
    </span>
  </button>
}
