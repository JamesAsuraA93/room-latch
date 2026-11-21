'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {User} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Logo} from '@/components/logo'
import {t} from '@/lib/copy'

// แถบบนเดียวกันทุกหน้า: โลโก้ + เส้นบาง ปุ่มเข้าสู่ระบบเฉพาะหน้าแรก (โปรไฟล์อยู่ในแถบล่างแล้ว)
export function AppBar() {
  const path = usePathname()
  return (
    <header className="sticky top-0 z-20 -mx-5 -mt-8 mb-5 flex min-h-14 items-center justify-between border-b border-zinc-200 bg-paper/95 px-5 pt-[env(safe-area-inset-top)] backdrop-blur">
      <Logo />
      {path === '/' && (
        <Button asChild variant="outline" className="min-h-10 px-3 text-xs">
          <Link href="/login"><User className="size-4" />{t.login}</Link>
        </Button>
      )}
    </header>
  )
}
