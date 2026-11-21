'use client'
import {useEffect, useState} from 'react'
import {PageHeader} from '@/components/page-header'
import Link from 'next/link'
import {LayoutDashboard, ShieldCheck, User} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger} from '@/components/ui/dialog'
import {fill, t} from '@/lib/copy'
import {readDrafts, readSocial} from '@/lib/demo'
import {authClient} from '@/lib/auth-client'
import {DRAFTS_KEY, LAST_DESIGN_KEY, PLACEMENT_KEY, PLAN_KEY, PRODUCT_RENDER_KEY, ROOM_IMAGE_KEY, ROOM_IMAGES_KEY, SOCIAL_KEY, STYLE_REFERENCE_KEY} from '@/lib/storage-keys'

const count = () => { const s = readSocial(); return {d: readDrafts().length, s: s.saves.length, p: s.posts.length} }

export function ProfileView({admin}: {admin: boolean}) {
  const [stats, setStats] = useState({d: 0, s: 0, p: 0})
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const {data: session} = authClient.useSession()
  const user = session?.user
  useEffect(() => setStats(count()), [])

  function clearAll() {
    try { localStorage.removeItem(SOCIAL_KEY); localStorage.removeItem(DRAFTS_KEY) } catch {}
    try { [PLAN_KEY, ROOM_IMAGE_KEY, ROOM_IMAGES_KEY, STYLE_REFERENCE_KEY, PRODUCT_RENDER_KEY, PLACEMENT_KEY, LAST_DESIGN_KEY].forEach(k => sessionStorage.removeItem(k)) } catch {}
    setStats(count()); setOpen(false); setDone(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t.profileTitle} />

      <section className="flex items-center gap-4 rounded-3xl bg-brand-soft p-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white text-brand"><User className="size-7" /></span>
        <div className="min-w-0 space-y-1">
          <p className="truncate font-semibold text-zinc-900">{user ? user.name : t.guest}</p>
          <p className="truncate text-xs text-zinc-600">{user ? user.email : t.guestHint}</p>
          <p className="text-xs font-medium text-ink">{fill(t.stats, stats)}</p>
        </div>
      </section>

      {admin && user && (
        <Button asChild className="w-full"><Link href="/admin"><LayoutDashboard className="size-4" />Admin dashboard</Link></Button>
      )}

      {user
        ? <Button variant="outline" className="w-full" onClick={() => authClient.signOut()}>{t.signOut}</Button>
        : <Button asChild variant="outline" className="w-full"><Link href="/login">{t.login}</Link></Button>}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-sage" />{t.privacyTitle}</h2>
        <ul className="space-y-2">
          {t.privacyItems.split('|').map(item => <li key={item} className="rounded-2xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">{item}</li>)}
        </ul>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50" onClick={() => setDone(false)}>{t.clearAll}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle className="text-lg font-bold">{t.clearAll}</DialogTitle>
          <DialogDescription className="mt-3 text-sm text-zinc-600">{t.clearConfirm}</DialogDescription>
          <Button className="mt-5 w-full bg-red-600 hover:bg-red-700" onClick={clearAll}>{t.clearYes}</Button>
        </DialogContent>
      </Dialog>
      {done && <p role="status" className="text-center text-sm text-sage">{t.cleared}</p>}
    </div>
  )
}
