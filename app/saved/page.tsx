'use client'
import {useEffect, useState} from 'react'
import {PageHeader} from '@/components/page-header'
import Image from 'next/image'
import {useRouter} from 'next/navigation'
import {Bookmark, Trash2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {baht, t} from '@/lib/copy'
import {EMPTY_SOCIAL, FEED, PLACEMENT_KEY, readDrafts, readSocial, roomName, savePlan, styleName, writeDrafts, writeSocial, type Draft, type FeedPost, type Social} from '@/lib/demo'

function Row({post, children}: {post: FeedPost; children?: React.ReactNode}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-2">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
        <Image src={post.after} alt={post.roomLabel} fill sizes="64px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold text-zinc-900">{post.roomLabel}</p>
        <p className="truncate text-xs text-zinc-500">{post.user} · {styleName(post.style)} · {baht(post.budget)}</p>
      </div>
      {children}
    </li>
  )
}

export default function Saved() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [social, setSocial] = useState<Social>(EMPTY_SOCIAL)
  useEffect(() => { setDrafts(readDrafts()); setSocial(readSocial()) }, [])

  function open(d: Draft) {
    // draft ไม่ใช่ Remix และไม่รู้ว่ารูปห้องตอนนี้เป็นรูปตัวอย่างไหม ใช้สถานะรูปของแท็บนี้แทน
    savePlan({style: d.plan.style, roomType: d.plan.roomType, budget: d.plan.budget, width: d.plan.width, remixOf: undefined})
    try { sessionStorage.setItem(PLACEMENT_KEY, JSON.stringify({pos: {}, photos: {}, locked: d.locked})) } catch {}
    router.push('/result')
  }
  function remove(id: string) {
    const next = drafts.filter(d => d.id !== id)
    setDrafts(next); writeDrafts(next)
  }
  function unsave(id: string) {
    const next = {...social, saves: social.saves.filter(x => x !== id)}
    setSocial(next); writeSocial(next)
  }

  const savedRooms = [...social.posts, ...FEED].filter(p => social.saves.includes(p.id))

  return (
    <div className="space-y-8">
      <PageHeader title={t.savedTitle} />

      <section className="space-y-3">
        <h2 className="font-semibold">{t.drafts}</h2>
        {drafts.length === 0 && <p className="text-sm text-zinc-500">{t.noDrafts}</p>}
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
