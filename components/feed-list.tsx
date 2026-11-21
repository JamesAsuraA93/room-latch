'use client'
import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {FeedCard} from '@/components/feed-card'
import {t} from '@/lib/copy'
import {EMPTY_SOCIAL, FEED, readSocial, savePlan, writeSocial, type FeedPost, type Social} from '@/lib/demo'

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])

// ฟีดตัวอย่าง + โพสต์ที่แชร์บนเครื่องนี้ ไลก์/เซฟเก็บใน localStorage
export function FeedList({limit, tabs = false}: {limit?: number; tabs?: boolean}) {
  const router = useRouter()
  const [social, setSocial] = useState<Social>(EMPTY_SOCIAL)
  const [onlySaved, setOnlySaved] = useState(false)
  useEffect(() => setSocial(readSocial()), [])

  function update(next: Social) { setSocial(next); writeSocial(next) }
  function remix(p: FeedPost) {
    savePlan({style: p.style, roomType: p.roomType, budget: p.budget, width: p.width, remixOf: p.user})
    router.push('/upload')
  }

  let posts = [...social.posts, ...FEED]
  if (onlySaved) posts = posts.filter(p => social.saves.includes(p.id))
  if (limit) posts = posts.slice(0, limit)

  return (
    <div className="space-y-4">
      {tabs && (
        <div role="tablist" className="flex gap-2">
          {[false, true].map(v => (
            <button key={String(v)} role="tab" aria-selected={onlySaved === v} onClick={() => setOnlySaved(v)}
              className={`min-h-11 rounded-full border px-4 text-sm ${onlySaved === v ? (v ? 'border-sage bg-sage text-white' : 'border-brand-soft bg-brand-soft font-semibold text-brand') : 'border-zinc-200 bg-white text-ink'}`}>
              {v ? `${t.savedPosts} (${social.saves.length})` : t.allPosts}
            </button>
          ))}
        </div>
      )}
      {posts.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">{t.noSaved}</p>}
      {posts.map(post => (
        <FeedCard key={post.id} post={post}
          liked={social.likes.includes(post.id)} saved={social.saves.includes(post.id)}
          onLike={() => update({...social, likes: toggle(social.likes, post.id)})}
          onSave={() => update({...social, saves: toggle(social.saves, post.id)})}
          onRemix={() => remix(post)}
          onRemove={post.local ? () => update({...social, posts: social.posts.filter(p => p.id !== post.id), saves: social.saves.filter(id => id !== post.id), likes: social.likes.filter(id => id !== post.id)}) : undefined}
        />
      ))}
    </div>
  )
}
