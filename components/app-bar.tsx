'use client'
import Link from 'next/link'
import {useEffect} from 'react'
import {usePathname} from 'next/navigation'
import {ArrowLeft, Check, UserRound} from 'lucide-react'
import {Logo} from '@/components/logo'
import {TabBar} from '@/components/tab-bar'
const STEPS = [{href:'/upload', label:'ห้อง สไตล์ งบ'}, {href:'/products', label:'เลือกสินค้า'}, {href:'/result', label:'ผลลัพธ์'}]
export function AppBar() {
  const path = usePathname()
  useEffect(() => { window.scrollTo(0, 0) }, [path])
  const index = STEPS.findIndex(s => s.href === path)
  const previous = index > 0 ? STEPS[index - 1].href : '/'
  return <header className="rl-appbar">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {path !== '/' && (
          <Link href={previous} aria-label="ย้อนกลับ" className="flex size-11 items-center justify-center rounded-full border border-white/30 hover:bg-white/15">
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <Logo />
      </div>
      <TabBar desktop />
      <Link href="/profile" aria-label="โปรไฟล์ของฉัน" className="flex size-11 items-center justify-center rounded-full border border-white/30 bg-white/10 md:hidden">
        <UserRound className="size-5" />
      </Link>
    </div>
    {index >= 0 ? <nav aria-label="ขั้นตอนออกแบบห้อง" className="rl-progress">
      {STEPS.map((step, i) => <div key={step.href} className="flex min-w-0 flex-1 items-center justify-center gap-2">
        {i <= index ? (
          <Link href={step.href} aria-current={i === index ? 'step' : undefined} className={`flex min-h-11 flex-col items-center gap-1.5 whitespace-nowrap text-xs sm:flex-row sm:gap-2 sm:text-sm ${i === index ? 'font-semibold text-white' : 'text-white/90'}`}>
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${i === index ? 'bg-white text-brand' : 'bg-white/15'}`}>{i < index ? <Check className="size-3.5" /> : i + 1}</span>
            {step.label}
          </Link>
        ) : (
          <span className="flex min-h-11 flex-col items-center gap-1.5 whitespace-nowrap text-xs text-white/80 sm:flex-row sm:gap-2 sm:text-sm">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/25">{i + 1}</span>
            {step.label}
          </span>
        )}
      </div>)}
    </nav> : null}
  </header>
}
