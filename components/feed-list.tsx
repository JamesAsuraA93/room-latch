'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {FeedCard} from '@/components/feed-card'
import {Skeleton} from '@/components/ui/skeleton'
import {t} from '@/lib/copy'
import {useFeedPosts, useSocial} from '@/lib/use-feed'
import {DEFAULT_PLAN, savePlan, type FeedPost} from '@/lib/demo'

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])

// ฟีดตัวอย่าง + โพสต์ที่แชร์บนเครื่องนี้ ไลก์/เซฟเก็บใน localStorage
export function FeedList({limit, tabs = false}: {limit?: number; tabs?: boolean}) {
  const router = useRouter()
  const [social, update] = useSocial()
  const [onlySaved, setOnlySaved] = useState(false)
  const {posts: feed, status} = useFeedPosts()

  function remix(p: FeedPost) {
    savePlan({style: p.style, roomType: p.roomType, budget: p.budget ?? DEFAULT_PLAN.budget, width: p.width ?? DEFAULT_PLAN.width, remixOf: p.user})
    router.push('/upload')
  }

  let posts = [...social.posts, ...feed]
  if (onlySaved) posts = posts.filter(p => social.saves.includes(p.id))
  if (limit) posts = posts.slice(0, limit)

  return (
    <div className="space-y-4">
      {tabs && (
        <div role="group" aria-label="กรองโพสต์" className="flex gap-2">
          {[false, true].map(v => (
            <button key={String(v)} aria-pressed={onlySaved === v} onClick={() => setOnlySaved(v)}
              className={`min-h-11 rounded-full border px-4 text-sm ${onlySaved === v ? (v ? 'border-sage bg-sage text-white' : 'border-brand-soft bg-brand-soft font-semibold text-brand') : 'border-zinc-200 bg-white text-ink'}`}>
              {v ? `${t.savedPosts} (${social.saves.length})` : t.allPosts}
            </button>
          ))}
        </div>
      )}
      {status === 'error' && <p role="status" className="rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500">{t.feedFailed}</p>}
      {posts.length === 0 && status !== 'loading' && <p className="py-10 text-center text-sm text-zinc-500">{t.noSaved}</p>}
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {status === 'loading' && !onlySaved && Array.from({length: Math.min(limit ?? 4, 4)}, (_, i) => (
        <div key={i} aria-hidden="true" className="space-y-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-1/2" /></div>
          </div>
          <Skeleton className="-mx-3 aspect-[16/10] rounded-none" />
          <div className="grid grid-cols-2 gap-2"><Skeleton className="h-10 rounded-full" /><Skeleton className="h-10 rounded-full" /></div>
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
      {posts.map(post => (
        <FeedCard key={post.id} post={post}
          liked={social.likes.includes(post.id)} saved={social.saves.includes(post.id)}
          onLike={() => update({...social, likes: toggle(social.likes, post.id)})}
          onSave={() => update({...social, saves: toggle(social.saves, post.id)})}
          onRemix={() => remix(post)}
          onRemove={post.local ? () => update({...social, posts: social.posts.filter(p => p.id !== post.id), saves: social.saves.filter(id => id !== post.id), likes: social.likes.filter(id => id !== post.id)}) : undefined}
        />
      ))}</div>
    </div>
  )
}
