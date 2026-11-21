'use client'
import {useRef, useState} from 'react'
import Image from 'next/image'
import {Bookmark, Heart, ImageOff, Shuffle, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Skeleton} from '@/components/ui/skeleton'
import {roomName, shopeeSearchUrl, styleName, type FeedPost} from '@/lib/demo'
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
    <article id={`design-${post.id}`} className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{post.user.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900">{post.user}</p>
          <p className="truncate text-xs text-zinc-600">{styleName(post.style)} · {roomName(post.roomType)}</p>
        </div>
        {post.budget ? <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-dark">{baht(post.budget)}</span> : null}
        {onRemove && <button type="button" aria-label={t.remove} onClick={onRemove} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"><Trash2 className="size-4" /></button>}
      </div>

      <div className="relative">
        <div ref={track} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[{src: post.before, alt: t.before}, {src: post.after, alt: t.after}].map(img => (
            <div key={img.alt} className="relative aspect-[16/10] w-full shrink-0 snap-center bg-stone-100">
              {img.src ? <FeedImage src={img.src} alt={`${post.roomLabel} ${img.alt}`} />
                : <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center" data-missing-image={img.alt}>
                    <ImageOff className="size-6 text-zinc-500" aria-hidden="true" />
                    <p className="text-sm font-medium text-zinc-700">{img.alt === t.before ? t.noVerifiedBefore : t.noAfterYet}</p>
                  </div>}
            </div>
          ))}
        </div>
        <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/65 px-2 py-1 text-xs font-medium text-white">{page === 0 ? t.before : `${t.after} · ${post.example || post.aiRender ? 'AI' : t.demo}`}</span>
        {(post.example || post.local) && <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-white/95 px-2 py-1 text-xs text-zinc-800">{post.local ? t.localOnly : t.examplePost}</span>}
      </div>

      <div className="flex items-center gap-1 border-b border-zinc-100 px-2 py-1">
        <div role="group" aria-label={t.swipeHint} className="flex min-w-0 flex-1 gap-1">
          {[t.before, t.after].map((label, i) => <button key={label} type="button" aria-pressed={page === i} onClick={() => show(i)} className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold ${page === i ? 'bg-brand-soft text-brand-dark' : 'text-zinc-600 hover:bg-zinc-50'}`}>{label}</button>)}
        </div>
        <button type="button" aria-pressed={liked} aria-label={t.like} onClick={onLike} className="rl-press flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-zinc-50"><Heart className={`size-5 ${liked ? 'fill-brand text-brand' : 'text-zinc-600'}`} /></button>
        <button type="button" aria-pressed={saved} aria-label={saved ? t.saved : t.save} onClick={onSave} className="rl-press flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-zinc-50"><Bookmark className={`size-5 ${saved ? 'fill-sage text-sage' : 'text-zinc-600'}`} /></button>
      </div>

      <div className="px-3 pb-3">
        <details>
          <summary className="cursor-pointer py-3 text-sm font-medium text-zinc-800">สินค้าในห้อง · {post.items.length} ชิ้น</summary>
          <ul className="mb-2 space-y-1">{post.items.map((item, i) => <li key={`${item.name}-${i}`}>
            <a href={item.url ?? shopeeSearchUrl(item.keyword ?? item.name)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm">
              <span className="line-clamp-2 min-w-0 text-zinc-800">{item.name}</span><span className="shrink-0 text-xs font-semibold text-brand">Shopee ↗</span>
            </a>
          </li>)}</ul>
          <p className="mb-3 text-xs leading-5 text-zinc-600">{post.items.some(i => i.url) ? t.exactNote : t.affNote}</p>
        </details>
        <Button variant="outline" className="min-h-11 w-full rounded-xl text-sm" onClick={onRemix}><Shuffle className="size-4" />ลองสไตล์นี้</Button>
      </div>
    </article>
  )
}

// skeleton until the image arrives; if it 404s/errors say so (with retry) instead of a blank box
function FeedImage({src, alt}: {src: string; alt: string}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  if (state === 'error') return (
    <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-8 text-center" data-failed-image={alt}>
      <ImageOff className="size-6 text-zinc-400" aria-hidden="true" />
      <p className="text-sm font-semibold text-zinc-600">{t.imageFailed}</p>
      <p className="text-[11px] text-zinc-500">{t.imageFailedHint}</p>
      <button type="button" onClick={() => { setState('loading'); setAttempt(a => a + 1) }} className="mt-2 min-h-9 rounded-full border border-zinc-300 bg-white px-4 text-xs font-semibold text-ink">{t.retry}</button>
    </div>
  )
  const url = attempt ? `${src}${src.includes('?') ? '&' : '?'}r=${attempt}` : src
  return (
    <>
      {state === 'loading' && <Skeleton className="absolute inset-0 rounded-none" aria-hidden="true" />}
      <Image key={url} src={url} alt={alt} fill sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" unoptimized={src.startsWith('/api/')}
        className={`object-contain transition-opacity ${state === 'ok' ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setState('ok')} onError={() => setState('error')} />
    </>
  )
}
