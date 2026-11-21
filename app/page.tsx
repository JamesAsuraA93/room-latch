import {FeedList} from '@/components/feed-list'
import {DemoButton, StartButton} from '@/components/start-button'
import {t} from '@/lib/copy'

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-brand p-5 text-white">
        <p className="text-xs font-semibold tracking-wide text-brand-soft">{t.tagline}</p>
        <h1 className="mt-1 text-2xl font-bold leading-snug">{t.homeTitle}</h1>
        <p className="mt-2 text-sm text-brand-soft">{t.homeSubtitle}</p>
        <StartButton className="mt-5 w-full bg-white text-brand hover:bg-brand-soft" />
        <DemoButton variant="ghost" className="mt-2 w-full text-white hover:bg-white/10" />
        <p className="mt-3 text-center text-[11px] text-brand-soft">{t.freeQuota}</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{t.feedTitle}</h2>
          <span className="text-[11px] text-zinc-400">{t.feedDemo}</span>
        </div>
        {/* หน้าแรกกับฟีดเป็นหน้าเดียวกัน: ฟีดเต็ม พร้อมแท็บ ทั้งหมด/ที่เซฟไว้ */}
        <FeedList tabs />
      </section>
    </div>
  )
}
