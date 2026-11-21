import * as React from 'react'

// หัวหน้าเดียวกันทุกหน้า: ชื่อหน้า + คำอธิบายสั้น (ถ้ามี)
export function PageHeader({title, children}: {title: string; children?: React.ReactNode}) {
  return (
    <header className="space-y-2">
      <h1 className="text-2xl font-semibold leading-snug tracking-tight text-ink md:text-[30px]">{title}</h1>
      {children && <div className="max-w-2xl text-base leading-relaxed text-zinc-700">{children}</div>}
    </header>
  )
}

// Single next action for setup steps; mobile navigation is hidden during these steps.
export function ActionBar({children}: {children: React.ReactNode}) {
  return (
    <div className="rl-actionbar">
      {children}
    </div>
  )
}
