import * as React from 'react'

// หัวหน้าเดียวกันทุกหน้า: ชื่อหน้า + คำอธิบายสั้น (ถ้ามี)
export function PageHeader({title, children}: {title: string; children?: React.ReactNode}) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-bold leading-tight text-ink">{title}</h1>
      {children && <div className="text-sm text-zinc-500">{children}</div>}
    </header>
  )
}

// ปุ่มหลักของหน้า: ติดอยู่เหนือแถบเมนูล่าง พื้นหลังจางลงจากสีกระดาษ จึงไม่บังเนื้อหาจนอ่านไม่ได้
export function ActionBar({children}: {children: React.ReactNode}) {
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-5 mt-auto bg-gradient-to-t from-paper via-paper to-paper/0 px-5 pb-2 pt-4">
      {children}
    </div>
  )
}
