'use client'
import {useState} from 'react'
import {Armchair, Sofa, Lamp, Table2, Package, Frame, LayoutGrid} from 'lucide-react'
import type {Furniture} from '@/lib/furniture'
import {baht} from '@/lib/copy'

const ICONS = {chair: Armchair, sofa: Sofa, light: Lamp, table: Table2, storage: Package, decor: Frame, rug: LayoutGrid}
export function FurnitureImage({item, className = ''}: {item: Furniture; className?: string}) {
  const [failed, setFailed] = useState(false)
  const Icon = ICONS[item.category] || Package
  return <div className={`flex items-center justify-center overflow-hidden bg-[#f0ece6] ${className}`}>
    {item.image && !failed ? <img src={item.image} alt={item.name} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain p-3" /> : <div className="flex flex-col items-center gap-2 p-3 text-brand/70"><Icon className="size-10" strokeWidth={1.25} /><span className="text-xs">ไม่มีภาพสินค้า</span></div>}
  </div>
}

export function FurniturePrice({item}: {item: Furniture}) {
  return <span className="text-base font-semibold text-brand-dark">{item.price === null ? 'ดูราคาในประกาศ' : `${item.priceKind === 'estimate' ? 'ประมาณ ' : 'เริ่มต้น '}${baht(item.price)}`}</span>
}
