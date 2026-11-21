'use client'
import {useEffect, useState} from 'react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Bookmark, Home, Sparkles, User} from 'lucide-react'
import {t} from '@/lib/copy'
import {LAST_DESIGN_KEY} from '@/lib/storage-keys'

const DESIGN = ['/upload', '/products', '/result']

const TABS = [
  {href: '/', label: t.tabFeed, icon: Home, match: ['/', '/feed']},
  {href: '/upload', label: t.tabDesign, icon: Sparkles, match: DESIGN},
  {href: '/saved', label: t.tabSaved, icon: Bookmark, match: ['/saved']},
  {href: '/profile', label: t.tabProfile, icon: User, match: ['/profile']},
]

export function TabBar({desktop = false}: {desktop?: boolean}) {
  const path = usePathname()
  const [designHref, setDesignHref] = useState('/upload')
  useEffect(() => {
    // LAST_DESIGN_KEY = ขั้นล่าสุดของการแต่งห้องในแท็บนี้: กดแท็บ "แต่งห้อง" แล้วกลับมาที่เดิม ไม่เริ่มใหม่ (draft อยู่ใน sessionStorage อยู่แล้ว)
    try {
      if (DESIGN.includes(path)) sessionStorage.setItem(LAST_DESIGN_KEY, path)
      const saved = sessionStorage.getItem(LAST_DESIGN_KEY)
      setDesignHref(saved && DESIGN.includes(saved) ? saved : '/upload')
    } catch {}
  }, [path])

  return (
    <nav aria-label="เมนูหลัก" className={desktop ? 'rl-desktop-nav' : `rl-tabbar ${['/upload', '/products'].includes(path) ? 'hidden' : ''}`}>
      <ul className={desktop ? 'flex items-center gap-1' : 'grid grid-cols-4'}>
        {TABS.map(({href, label, icon: Icon, match}) => {
          const active = match.some(m => path === m || path.startsWith(`${m}/`))
          return (
            <li key={label}>
              <Link href={match === DESIGN ? designHref : href} aria-current={active ? 'page' : undefined}
                className={desktop
                  ? `flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm transition-colors motion-reduce:transition-none ${active ? 'bg-white/20 font-semibold text-white' : 'text-white/90 hover:bg-white/10'}`
                  : `m-1 flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs transition-colors motion-reduce:transition-none ${active ? 'bg-brand-soft font-semibold text-brand-dark' : 'font-medium text-zinc-600'}`}>
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
