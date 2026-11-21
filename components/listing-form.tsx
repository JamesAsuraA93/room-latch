'use client'
import {useId, useState} from 'react'
import type {Product} from '@/lib/plan'
import {EXAMPLE_LISTING, shopeeUrl} from '@/lib/demo'
import {IMAGE_ACCEPT, resizeRoomImage} from '@/lib/image'
import {fill, t} from '@/lib/copy'
import {Button} from '@/components/ui/button'

const field = 'min-h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-brand'
const EMPTY = {url: '', name: '', price: '', width: '', floor: false, photo: undefined as string | undefined}

export function ListingForm({roomType, style, onLock}: {roomType: string; style: string; onLock: (p: Product, photo?: string) => void}) {
  const id = useId()
  const [f, setF] = useState(EMPTY)
  const [err, setErr] = useState<{url?: string; price?: string}>({})
  const [fileKey, setFileKey] = useState(0) // remount file input on reset
  const set = (patch: Partial<typeof EMPTY>) => setF(prev => ({...prev, ...patch}))
  const digits = (s: string) => s.replace(/\D/g, '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const url = shopeeUrl(f.url), price = Number(f.price)
    const next = {url: url ? undefined : t.badUrl, price: price > 0 ? undefined : t.needPrice}
    setErr(next)
    if (!url || next.price || !f.name.trim()) return
    const pid = `custom-${Date.now()}`
    onLock({id: pid, roomType, slot: pid, name: f.name.trim(), keyword: f.name.trim(), styles: [style], priceMin: price, priceMax: price,
      priority: 1, deeplink: url, widthCm: Number(f.width) || null, floor: f.floor}, f.photo)
    setF(EMPTY)
    setFileKey(k => k + 1)
  }

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return set({photo: undefined})
    try { set({photo: await resizeRoomImage(file, 600)}) } catch { e.target.value = ''; set({photo: undefined}) }
  }

  return (
    <details className="mx-auto w-full max-w-[480px] rounded-3xl border border-zinc-200 bg-white p-4" open>
      <summary className="min-h-11 cursor-pointer text-lg font-bold text-ink">{t.pickFirst}</summary>
      <p className="mb-4 text-xs text-zinc-500">{t.pickFirstHint}</p>

      <div className="mb-4 space-y-2 rounded-2xl bg-brand-soft p-3">
        <p className="text-xs text-brand-dark">{fill(t.exampleListing, {name: EXAMPLE_LISTING.name})}</p>
        <Button type="button" variant="outline" className="w-full" onClick={() => { set({url: EXAMPLE_LISTING.url, name: EXAMPLE_LISTING.name}); setErr({}) }}>
          {t.useExample}
        </Button>
      </div>

      <form onSubmit={submit} noValidate className="space-y-3">
        <div className="space-y-1">
          <label htmlFor={`${id}-url`} className="block text-sm font-semibold">{t.listingUrl}</label>
          <input id={`${id}-url`} type="url" inputMode="url" required value={f.url} onChange={e => set({url: e.target.value})}
            aria-invalid={!!err.url} aria-describedby={err.url ? `${id}-url-err` : undefined} className={field} />
          {err.url && <p id={`${id}-url-err`} className="text-xs text-red-600">{err.url}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-name`} className="block text-sm font-semibold">{t.listingName}</label>
          <input id={`${id}-name`} required value={f.name} onChange={e => set({name: e.target.value})} className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-price`} className="block text-sm font-semibold">{t.listingPrice}</label>
          <input id={`${id}-price`} inputMode="numeric" pattern="[0-9]*" required value={f.price} onChange={e => set({price: digits(e.target.value)})}
            aria-invalid={!!err.price} aria-describedby={err.price ? `${id}-price-err` : undefined} className={field} />
          {err.price && <p id={`${id}-price-err`} className="text-xs text-red-600">{err.price}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-width`} className="block text-sm font-semibold">{t.listingWidth}</label>
          <input id={`${id}-width`} inputMode="numeric" pattern="[0-9]*" value={f.width} onChange={e => set({width: digits(e.target.value)})} className={field} />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={f.floor} onChange={e => set({floor: e.target.checked})} className="size-5 accent-[var(--color-brand)]" />
          {t.listingFloor}
        </label>
        <label className="block space-y-1">
          <span className="block text-sm font-semibold">{t.productPhoto}</span>
          <span className="block text-xs text-zinc-500">{t.productPhotoHint}</span>
          <input key={fileKey} type="file" accept={IMAGE_ACCEPT} onChange={onPhoto}
            className="block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-2xl file:border-0 file:bg-brand-soft file:px-4 file:text-brand-dark" />
        </label>
        <p className="text-xs text-zinc-500">{t.userEntered}</p>
        <Button type="submit" className="w-full" disabled={!f.name.trim()}>{t.lockItem}</Button>
      </form>
    </details>
  )
}
