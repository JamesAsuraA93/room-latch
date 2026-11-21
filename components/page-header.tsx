import * as React from 'react'

// หัวหน้าเดียวกันทุกหน้า: ชื่อหน้า + คำอธิบายสั้น (ถ้ามี)
export function PageHeader({title, children}: {title: string; children?: React.ReactNode}) {
  return (
    <header className="space-y-2">
      <h1 className="text-[26px] font-semibold leading-snug tracking-tight text-ink md:text-3xl">{title}</h1>
      {children && <div className="max-w-2xl text-sm leading-relaxed text-zinc-500">{children}</div>}
    </header>
  )
}

// ปุ่มหลักของหน้า: ติดอยู่เหนือแถบเมนูล่าง พื้นหลังจางลงจากสีกระดาษ จึงไม่บังเนื้อหาจนอ่านไม่ได้
export function ActionBar({children}: {children: React.ReactNode}) {
  return (
    <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 mt-auto bg-gradient-to-t from-paper via-paper to-paper/0 pb-2 pt-5 [&>button]:mx-auto [&>button]:flex [&>button]:max-w-md">
      {children}
    </div>
  )
}
