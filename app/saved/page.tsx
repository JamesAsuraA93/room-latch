'use client'
import {useEffect, useState} from 'react'
import {PageHeader} from '@/components/page-header'
import Image from 'next/image'
import {useRouter} from 'next/navigation'
import {Bookmark, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {StartButton} from '@/components/start-button'
import {baht, t} from '@/lib/copy'
import {readDrafts, roomName, savePlan, styleName, writeDrafts, writePlacement, type Draft, type FeedPost} from '@/lib/demo'
import {useFeedPosts, useSocial} from '@/lib/use-feed'
import {saveDesignSession, saveSelection} from '@/lib/design-session'
import {selectionContext} from '@/lib/furniture'

function Row({post, children}: {post: FeedPost; children?: React.ReactNode}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-2">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
        {post.after && <Image src={post.after} alt={post.roomLabel} fill sizes="64px" className="object-cover" unoptimized={post.after.startsWith('/api/')} />}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold text-zinc-900">{post.roomLabel}</p>
        <p className="truncate text-xs text-zinc-500">{post.user} · {styleName(post.style)}{post.budget ? ` · ${baht(post.budget)}` : ''}</p>
      </div>
      {children}
    </li>
  )
}

export default function Saved() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [social, setSocial] = useSocial()
  const {posts: feed} = useFeedPosts()
  useEffect(() => setDrafts(readDrafts()), [])

  function open(d: Draft) {
    // draft ไม่ใช่ Remix และไม่รู้ว่ารูปห้องตอนนี้เป็นรูปตัวอย่างไหม ใช้สถานะรูปของแท็บนี้แทน
    savePlan({style: d.plan.style, roomType: d.plan.roomType, budget: d.plan.budget, width: d.plan.width, remixOf: undefined})
    writePlacement({pos: {}, photos: {}, locked: d.locked})
    if (d.furniture) saveSelection({context: selectionContext(d.plan), items: d.furniture})
    if (d.renderJob && d.furniture) {
      saveDesignSession({job: d.renderJob, items: d.furniture, plan: d.plan, before: '', photoCount: d.photoCount ?? 0})
      router.push(`/result?job=${encodeURIComponent(d.renderJob.id)}`)
    } else router.push('/products')
  }
  function remove(id: string) {
    const next = drafts.filter(d => d.id !== id)
    setDrafts(next); writeDrafts(next)
  }
  function unsave(id: string) {
    setSocial({...social, saves: social.saves.filter(x => x !== id)})
  }

  const savedRooms = [...social.posts, ...feed].filter(p => social.saves.includes(p.id))

  return (
    <div className="space-y-8">
      <PageHeader title={t.savedTitle} />

      <section className="space-y-3">
        <h2 className="font-semibold">{t.drafts}</h2>
        {drafts.length === 0 && <div className="space-y-4 rounded-2xl border border-dashed border-[#d4c7b9] bg-white p-6 text-center">
          <p className="text-sm text-zinc-600">{t.noDrafts}</p>
          <StartButton />
        </div>}
        <ul className="space-y-3">
          {drafts.map(d => (
            <li key={d.id} className="space-y-2 rounded-2xl border border-zinc-200 p-4">
              <p className="text-sm font-semibold text-zinc-900">{roomName(d.plan.roomType)} · {styleName(d.plan.style)}</p>
              <p className="text-xs text-zinc-500">{baht(d.plan.budget)} · {d.plan.width} {t.cm} · {new Date(d.savedAt).toLocaleDateString('th-TH')}</p>
              {d.items.length > 0 && <p className="text-xs text-zinc-600">{d.items.join(', ')}</p>}
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={() => open(d)}>{t.openDraft}</Button>
                <Button variant="outline" onClick={() => remove(d.id)}><Trash2 className="size-4" />{t.deleteDraft}</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-sage"><Bookmark className="size-5 fill-sage" />{t.savedRooms}</h2>
        {savedRooms.length === 0 && <p className="text-sm text-zinc-500">{t.noSaved}</p>}
        <ul className="space-y-2">
          {savedRooms.map(p => (
            <Row key={p.id} post={p}>
              <button type="button" aria-pressed aria-label={t.saved} onClick={() => unsave(p.id)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-zinc-50">
                <Bookmark className="size-6 fill-sage text-sage" />
              </button>
            </Row>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{t.myPosts}</h2>
        {social.posts.length === 0 && <p className="text-sm text-zinc-500">{t.noMyPosts}</p>}
        <ul className="space-y-2">
          {social.posts.map(p => (
            <Row key={p.id} post={p}>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[10px] text-zinc-600">{t.localOnly}</span>
            </Row>
          ))}
        </ul>
      </section>
    </div>
  )
}
