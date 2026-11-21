'use client'
import {useState} from 'react'

export function useListingRank() {
  const [fits, setFits] = useState<Record<string, number>>()
  const [ranking, setRanking] = useState(false)
  const [note, setNote] = useState('')

  async function rank(room: string, style: string, ids: string[]) {
    if (!room.startsWith('data:')) { setNote('เพิ่มรูปห้องก่อนเรียงสินค้า'); return }
    if (!ids.length) { setNote('ยังไม่มีประกาศสินค้าในสไตล์นี้ให้เรียง'); return }
    setRanking(true); setNote('')
    try {
      const form = new FormData()
      form.append('image', await (await fetch(room)).blob(), 'room.jpg')
      form.append('style', style)
      form.append('ids', JSON.stringify(ids.slice(0, 40)))
      const response = await fetch('/api/listings/rank', {method: 'POST', body: form})
      const result = await response.json()
      if (result.error?.code === 'rank_disabled') { setNote('เซิร์ฟเวอร์นี้ยังไม่ได้เปิดการเรียงตามห้อง'); return }
      if (!response.ok) throw new Error('rank_failed')
      setFits(Object.fromEntries((result.fits as {id: string; score: number}[]).map(f => [f.id, f.score])))
      if (result.unranked?.length) setNote(`${result.unranked.length} ชิ้นยังไม่มีรูปในคลัง จึงยังไม่ได้ให้คะแนน`)
    } catch { setNote('เรียงไม่สำเร็จ กรุณาลองใหม่') }
    finally { setRanking(false) }
  }

  return {fits, ranking, note, rank}
}
