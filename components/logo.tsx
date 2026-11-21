import Link from 'next/link'
import {BRAND} from '@/lib/copy'

// โลโก้ภาพห้องจิ๋ว ไฟล์เดียวกับ manifest (public/icon-192.png) และ favicon (app/icon.png = public/icon-512.png)
// เฉพาะ header: ตัดพื้นกระเบื้องดินเผารอบห้องออกด้วย clip-path ตามขอบนอกของห้อง (พิกัดจาก master สี่เหลี่ยม
// หดเข้า ~0.5% กันขอบดินเผาค้าง) แล้วขยาย 1.2 เท่าจากกึ่งกลางในช่อง 32px โปร่งใส ไฟล์รูปไม่ได้แก้
const ROOM_OUTLINE = 'polygon(50% 12%, 51.3% 12.4%, 85.5% 26.7%, 86.1% 27.8%, 86.1% 75.3%, 85.3% 76.7%, 59.8% 88%, 40.5% 88%, 13.8% 76.9%, 13% 75.2%, 13% 28.5%, 13.7% 26.9%, 48.8% 12.3%)'

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-lg font-bold text-ink">
      <span className="relative block size-8 shrink-0">
        <img src={BRAND.logo} alt="" width={32} height={32} className="absolute inset-0 size-8 scale-[1.2] object-contain" style={{clipPath: ROOM_OUTLINE}} />
      </span>
      {BRAND.name}
    </Link>
  )
}
