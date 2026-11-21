import Link from 'next/link'
import {BRAND} from '@/lib/copy'

// โลโก้ไฟล์เดียวกับ favicon (public/logo.svg)
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-bold text-ink">
      <img src={BRAND.logo} alt="" width={32} height={32} className="size-8" />
      {BRAND.name}
    </Link>
  )
}
