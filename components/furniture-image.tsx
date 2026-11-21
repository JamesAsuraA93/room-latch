'use client'
import {useEffect, useState} from 'react'
import {Armchair, Sofa, Lamp, Table2, Package, Frame, LayoutGrid} from 'lucide-react'
import type {Furniture} from '@/lib/furniture'
import {baht} from '@/lib/copy'

const ICONS = {chair: Armchair, sofa: Sofa, light: Lamp, table: Table2, storage: Package, decor: Frame, rug: LayoutGrid}
export function FurnitureImage({item, className = '', onUnavailable, onReady}: {item: Furniture; className?: string; onUnavailable?: (id: string) => void; onReady?: (id: string) => void}) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const unavailable = !item.image || failedSource === item.image
  useEffect(() => { if (unavailable) onUnavailable?.(item.id) }, [unavailable, item.id, onUnavailable])
  const Icon = ICONS[item.category] || Package
  if (unavailable && onUnavailable) return null
  return <div className={`flex items-center justify-center overflow-hidden bg-[#f0ece6] ${className}`}>
    {!unavailable ? <img src={item.image!} alt={item.name} loading={onReady ? 'eager' : 'lazy'} onLoad={() => onReady?.(item.id)} onError={() => setFailedSource(item.image)} className="h-full w-full object-contain p-3" /> : <div className="flex flex-col items-center gap-2 p-3 text-brand/70"><Icon className="size-10" strokeWidth={1.25} /><span className="text-xs">ไม่มีภาพสินค้า</span></div>}
  </div>
}

export function FurniturePrice({item}: {item: Furniture}) {
  return <span className="text-base font-semibold text-brand-dark">{item.price === null ? 'ดูราคาในประกาศ' : `${item.priceKind === 'estimate' ? 'ประมาณ ' : 'เริ่มต้น '}${baht(item.price)}`}</span>
}
