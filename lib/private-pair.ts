'use client'
import {useSyncExternalStore} from 'react'

// รูปคู่ส่วนตัว (Before จริง / After AI) อยู่ในหน่วยความจำของแท็บเท่านั้น: ไม่เขียน storage ไม่อัปโหลด รีเฟรชแล้วหาย
export type Pic = {url: string; w: number; h: number; name: string}
type Pair = {before: Pic | null; after: Pic | null}

let pair: Pair = {before: null, after: null}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function setPic(slot: keyof Pair, pic: Pic | null) {
  const old = pair[slot]
  if (old && old.url !== pic?.url && old.url.startsWith('blob:')) URL.revokeObjectURL(old.url)
  pair = {...pair, [slot]: pic}
  emit()
}
export const getPair = () => pair
export function usePrivatePair() {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, getPair, getPair)
}

export const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']
/** อ่านไฟล์ในเครื่องเป็น ObjectURL (ใช้ onload เพราะ img.decode() ค้างได้กับรูปที่ไม่อยู่ใน DOM) */
export async function loadPic(file: File): Promise<Pic> {
  if (!ACCEPT.includes(file.type)) throw new Error(`ไฟล์ ${file.name} ไม่ใช่ jpg/png/webp`)
  const url = URL.createObjectURL(file)
  const img = new Image()
  const ok = await new Promise<boolean>(r => { img.onload = () => r(true); img.onerror = () => r(false); img.src = url })
  if (!ok) { URL.revokeObjectURL(url); throw new Error(`อ่านรูป ${file.name} ไม่ได้`) }
  return {url, w: img.naturalWidth, h: img.naturalHeight, name: file.name}
}
