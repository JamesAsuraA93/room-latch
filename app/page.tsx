import Link from 'next/link'
import {ArrowUpRight, Camera, Palette, SlidersHorizontal} from 'lucide-react'
import {FeedList} from '@/components/feed-list'
import {DemoButton, StartButton} from '@/components/start-button'
import {styleImage, styleName} from '@/lib/demo'

const STEPS = [
  {icon: Camera, title: '01 · รูปห้อง', hint: 'เพิ่มได้ 4 มุม'},
  {icon: Palette, title: '02 · สไตล์', hint: 'เลือกหรือเพิ่มภาพเอง'},
  {icon: SlidersHorizontal, title: '03 · งบของคุณ', hint: 'เลือกของให้พอดี'},
]

export default function Home() {
  return <div className="space-y-9">
    <section className="grid items-center gap-6 md:grid-cols-[.85fr_1.15fr]">
      <div className="space-y-5">
        <p className="rl-section-label">YOUR SPACE, YOUR WAY</p>
        <h1 className="text-3xl font-semibold leading-[1.45] tracking-tight md:text-[38px]">ห้องเดิมของคุณ<br /><span className="text-brand">ในแบบที่ชอบกว่าเดิม</span></h1>
        <p className="max-w-sm text-sm leading-7 text-zinc-500">เริ่มจากรูปห้อง เลือกบรรยากาศที่ชอบ<br />แล้วค่อยหาของที่พอดีกับพื้นที่และงบของคุณ</p>
        <div className="space-y-2 md:max-w-xs">
          <StartButton className="w-full" />
          <DemoButton variant="ghost" className="w-full" />
        </div>
      </div>
      <div className="rl-photo relative overflow-hidden rounded-[30px]">
        <img src={styleImage('japandi')} alt="ห้องนั่งเล่นโทนไม้ธรรมชาติสำหรับดูเป็นแรงบันดาลใจ" className="aspect-[4/3] w-full object-cover" />
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-2xl bg-white/95 p-4 backdrop-blur">
          <div>
            <p className="text-sm font-semibold">A softer kind of living</p>
            <p className="mt-1 text-xs text-zinc-500">ภาพแรงบันดาลใจ · Japandi</p>
          </div>
          <Link href="/style" aria-label="สำรวจสไตล์" className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand">
            <ArrowUpRight className="size-5" />
          </Link>
        </div>
      </div>
    </section>

    <div className="grid grid-cols-3 gap-3 rounded-[26px] bg-white p-4 md:p-5">
      {STEPS.map(({icon: Icon, title, hint}) => (
        <div key={title} className="flex flex-col items-center gap-2 text-center md:flex-row md:gap-3 md:text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-paper text-brand"><Icon className="size-5" /></span>
          <div>
            <p className="text-xs font-semibold md:text-sm">{title}</p>
            <p className="mt-1 text-[10px] text-zinc-500 md:text-xs">{hint}</p>
          </div>
        </div>
      ))}
    </div>

    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="rl-section-label">ROOM INSPIRATION</p>
          <h2 className="mt-2 text-xl font-semibold">ไอเดียสำหรับห้องของคุณ</h2>
        </div>
        <span className="text-xs text-zinc-500">ภาพตัวอย่าง</span>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {['muji', 'loft', 'scandi'].map(id => (
          <Link key={id} href="/style" className="rl-room-choice overflow-hidden rounded-[24px] bg-white last:hidden md:last:block">
            <img src={styleImage(id, 600)} alt={`แรงบันดาลใจสไตล์ ${styleName(id)}`} className="aspect-[4/3] w-full object-cover" />
            <div className="flex items-center justify-between p-4">
              <div>
                <h3 className="text-sm font-semibold">{styleName(id)}</h3>
                <p className="mt-1 text-[11px] text-zinc-500">ดูสไตล์และเริ่มออกแบบ</p>
              </div>
              <ArrowUpRight className="size-4 text-brand" />
            </div>
          </Link>
        ))}
      </div>
    </section>

    <details className="rl-disclosure">
      <summary>สำรวจฟีดและห้องที่บันทึกไว้</summary>
      <FeedList tabs />
    </details>
  </div>
}
