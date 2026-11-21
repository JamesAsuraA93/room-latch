'use client'
import {useEffect, useState} from 'react'
import {fill, t} from '@/lib/copy'
import {readPlan, styleName} from '@/lib/demo'

// โชว์ตลอด flow ถ้าผู้ใช้กด Remix มาจากฟีด จะได้รู้ว่าค่าที่กรอกไว้ให้มาจากห้องไหน
export function RemixBanner() {
  const [text, setText] = useState('')
  useEffect(() => {
    const p = readPlan()
    if (p.remixOf) setText(fill(t.remixBanner, {user: p.remixOf, style: styleName(p.style), budget: p.budget.toLocaleString('th-TH'), width: p.width}))
  }, [])
  if (!text) return null
  return <p className="rounded-2xl bg-brand-soft px-3 py-2 text-xs text-brand-dark">{text}</p>
}
