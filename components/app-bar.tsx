'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {ArrowLeft, Check, UserRound} from 'lucide-react'
import {Logo} from '@/components/logo'
const STEPS = [{href:'/upload', label:'รูปห้อง'}, {href:'/style', label:'สไตล์'}, {href:'/setup', label:'งบ/ขนาด'}, {href:'/result', label:'ผลลัพธ์'}]
export function AppBar() {
  const path = usePathname()
  const index = path === '/loading' ? 3 : STEPS.findIndex(s => s.href === path)
  const previous = index > 0 ? STEPS[index - 1].href : '/'
  return <header className="rl-appbar">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {path !== '/' && <Link href={previous} aria-label="ย้อนกลับ" className="flex size-10 items-center justify-center rounded-full border border-white/30 hover:bg-white/15"><ArrowLeft className="size-5" /></Link>}
        <Logo />
      </div>
      <Link href="/profile" aria-label="โปรไฟล์ของฉัน" className="flex size-11 items-center justify-center rounded-full border border-white/30 bg-white/10"><UserRound className="size-5" /></Link>
    </div>
    {index >= 0 ? <nav aria-label="ขั้นตอนออกแบบห้อง" className="mt-7 flex max-w-xl items-center justify-between gap-2">
      {STEPS.map((step, i) => <div key={step.href} className="flex min-w-0 flex-1 items-center gap-2">
        {i <= index ? <Link href={step.href} aria-current={i === index ? 'step' : undefined} className={`flex items-center gap-2 text-xs ${i === index ? 'font-bold text-white' : 'text-white/80'}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${i === index ? 'bg-white text-brand' : 'bg-white/15'}`}>{i < index ? <Check className="size-3.5" /> : i + 1}</span>{step.label}</Link> : <span className="flex items-center gap-2 text-xs text-white/65"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/25">{i+1}</span>{step.label}</span>}
      </div>)}
    </nav> : <p className="mt-5 text-sm text-white/85">A little inspiration. A room that feels like you.</p>}
  </header>
}
