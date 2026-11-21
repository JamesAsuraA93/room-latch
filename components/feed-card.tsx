'use client'
import {useRef, useState} from 'react'
import Image from 'next/image'
import {Bookmark, Heart, ImageOff, Shuffle, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {SHOPEE_SEARCH, roomName, styleName, type FeedPost} from '@/lib/demo'
import {baht, t} from '@/lib/copy'

type Props = {post: FeedPost; liked: boolean; saved: boolean; onLike: () => void; onSave: () => void; onRemix: () => void; onRemove?: () => void}

// ปัดซ้ายขวาดูก่อน/หลังแบบ reels ใช้ scroll-snap ของเบราว์เซอร์ ไม่ต้องพึ่งไลบรารี
export function FeedCard({post, liked, saved, onLike, onSave, onRemix, onRemove}: Props) {
  const track = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  function show(i: number) {
    const el = track.current
    if (el) el.scrollTo({left: i * el.clientWidth, behavior: 'instant'}) // tap = instant switch; swipe stays smooth
    setPage(i)
  }
  function onScroll() {
    const el = track.current
    if (!el) return
    setPage(Math.round(el.scrollLeft / el.clientWidth))
  }
  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white">
      <div className="flex items-center gap-2.5 p-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{post.user.slice(0, 1)}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-semibold text-zinc-900">{post.user}</p>
          <p className="truncate text-xs text-zinc-500">{post.roomLabel} · {styleName(post.style)}{post.budget ? ` · ${baht(post.budget)}` : ''}</p>
        </div>
        {post.example && <span className="shrink-0 rounded-full bg-brand-soft px-2 py-1 text-[10px] text-brand">{t.examplePost}</span>}
        {post.local && <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[10px] text-zinc-600">{t.localOnly}</span>}
      </div>

      <div className="relative">
        <div ref={track} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth">
          {[{src: post.before, alt: t.before}, {src: post.after, alt: t.after}].map(img => (
            <div key={img.alt} className="relative h-80 w-full shrink-0 snap-center bg-zinc-100">
              {img.src
                ? <Image src={img.src} alt={`${post.roomLabel} ${img.alt}`} fill sizes="(max-width: 480px) 100vw, 480px" className="object-cover" unoptimized={img.src.startsWith('/api/')} />
                : <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-8 text-center" data-missing-image={img.alt}>
                    <ImageOff className="size-6 text-zinc-400" aria-hidden="true" />
                    <p className="text-sm font-semibold text-zinc-600">{img.alt === t.before ? t.noVerifiedBefore : t.noAfterYet}</p>
                    <p className="text-[11px] text-zinc-500">{t.noStockNote}</p>
                  </div>}
            </div>
          ))}
        </div>
        {(post.before || post.after) && (
          <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium text-white ${page === 0 ? 'bg-black/60' : 'bg-brand/90'}`}>
            {page === 0 ? t.before : `${t.after} · ${post.example ? t.aiIllustrative : t.demo}`}
          </span>
        )}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {[0, 1].map(i => <span key={i} className={`size-1.5 rounded-full ${page === i ? 'bg-zinc-700' : 'bg-zinc-400/60'}`} />)}
        </div>
      </div>

      <div role="group" aria-label={t.swipeHint} className="grid grid-cols-2 gap-2 px-3 pt-3">
        {[t.before, t.after].map((label, i) => (
          <button key={label} type="button" aria-pressed={page === i} onClick={() => show(i)}
            className={`min-h-10 rounded-full border text-sm font-semibold ${page === i ? 'border-brand bg-brand text-white' : 'border-zinc-200 bg-white text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 px-2 pt-2">
        <button type="button" aria-pressed={liked} aria-label={t.like} onClick={onLike} className="rl-press flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-zinc-50">
          <Heart key={String(liked)} className={`size-6 ${liked ? 'rl-pop fill-brand text-brand' : 'text-ink'}`} />
        </button>
        <button type="button" aria-pressed={saved} aria-label={saved ? t.saved : t.save} onClick={onSave} className="rl-press flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-zinc-50">
          <Bookmark key={String(saved)} className={`size-6 ${saved ? 'rl-pop fill-sage text-sage' : 'text-ink'}`} />
        </button>
        {onRemove && (
          <button type="button" aria-label={t.remove} onClick={onRemove} className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-50">
            <Trash2 className="size-5" />
          </button>
        )}
      </div>

      <div className="space-y-2.5 p-3 pt-1">
        <p className="text-xs font-semibold text-zinc-900">{t.itemsInRoom} {post.items.length} {t.pieces} · {roomName(post.roomType)}{post.width ? ` ${post.width} ${t.cm}` : ''}</p>
        <ul className="space-y-1.5">
          {post.items.map(item => (
            <li key={item.name}>
              <a href={item.url ?? `${SHOPEE_SEARCH}${encodeURIComponent(item.keyword ?? item.name)}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-sm font-medium text-zinc-900">{item.name}</span>
                  <span className="block text-xs text-zinc-500">{item.url ? t.exactListingNote : `${t.approx} ${item.priceRange ?? ''}`}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-brand">{t.viewShopee} ›</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-zinc-400">{post.items.some(i => i.url) ? t.exactNote : t.affNote}</p>
        <Button variant="outline" className="w-full border-sage/40 text-sage hover:bg-sage/5" onClick={onRemix}><Shuffle className="size-4" />{t.remix}</Button>
      </div>
    </article>
  )
}
