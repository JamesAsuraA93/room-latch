'use client'
import {useEffect, useState} from 'react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Bookmark, Home, Sparkles, User} from 'lucide-react'
import {t} from '@/lib/copy'

const DESIGN = ['/upload', '/style', '/setup', '/loading', '/result']
// ขั้นล่าสุดของการแต่งห้องในแท็บนี้: กดแท็บ "แต่งห้อง" แล้วกลับมาที่เดิม ไม่เริ่มใหม่ (draft อยู่ใน sessionStorage อยู่แล้ว)
const LAST_DESIGN_KEY = 'room-ai-last-design'

const TABS = [
  {href: '/', label: t.tabFeed, icon: Home, match: ['/']},
  {href: '/upload', label: t.tabDesign, icon: Sparkles, match: DESIGN},
  {href: '/saved', label: t.tabSaved, icon: Bookmark, match: ['/saved']},
  {href: '/profile', label: t.tabProfile, icon: User, match: ['/profile']},
]

export function TabBar() {
  const path = usePathname()
  const [designHref, setDesignHref] = useState('/upload')
  useEffect(() => {
    try {
      // /loading ยิง /api/render ซ้ำ จึงจำเป็น /setup แทน
      if (DESIGN.includes(path)) sessionStorage.setItem(LAST_DESIGN_KEY, path === '/loading' ? '/setup' : path)
      setDesignHref(sessionStorage.getItem(LAST_DESIGN_KEY) || '/upload')
    } catch {}
  }, [path])

  return (
    <nav className="rl-tabbar">
      <ul className="grid grid-cols-4">
        {TABS.map(({href, label, icon: Icon, match}) => {
          const active = match.some(m => path === m || path.startsWith(`${m}/`))
          return (
            <li key={label}>
              <Link href={match === DESIGN ? designHref : href} aria-current={active ? 'page' : undefined}
                className={`mx-1.5 my-1.5 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] transition-colors motion-reduce:transition-none ${active ? 'bg-brand-soft font-bold text-brand-dark' : 'font-medium text-zinc-500'}`}>
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
