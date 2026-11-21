import Link from 'next/link'
import {ArrowRight, Camera, Armchair, Sparkles} from 'lucide-react'
import {DemoButton, StartButton} from '@/components/start-button'
import {StyleInspiration} from '@/components/style-inspiration'
import {styleImage} from '@/lib/demo'

const STEPS = [
  {icon: Camera, title: 'รูปห้อง สไตล์ งบ'},
  {icon: Armchair, title: 'เลือกและเปลี่ยนสินค้า'},
  {icon: Sparkles, title: 'ดูผลลัพธ์'},
]

export default function Home() {
  return <div className="space-y-8 md:space-y-10">
    <section className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
      <div className="space-y-5">
        <h1 className="text-[32px] font-semibold leading-[1.4] tracking-tight lg:text-[42px]">ห้องเดิมของคุณ<br /><span className="text-brand">ในสไตล์ที่ชอบ</span></h1>
        <p className="max-w-sm text-base leading-7 text-zinc-600">ลองแต่งห้องจากรูปของคุณ<br className="hidden md:block" /> พร้อมเลือกของให้พอดีกับงบ</p>
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
          <StartButton />
          <DemoButton variant="outline" />
        </div>
        <p className="text-sm text-zinc-500">เริ่มได้เลย ไม่ต้องสมัครสมาชิก</p>
      </div>
      <figure className="rl-photo relative overflow-hidden rounded-[24px]">
        <img src={styleImage('japandi')} alt="ไอเดียห้องนั่งเล่นโทนไม้ธรรมชาติ" fetchPriority="high" className="aspect-[16/10] max-h-[55dvh] w-full object-cover" />
        <figcaption className="absolute bottom-4 left-4 rounded-full bg-white/95 px-4 py-2 text-sm font-medium">ห้องตัวอย่าง · เจแปนดิ</figcaption>
      </figure>
    </section>

    <ol aria-label="เริ่มออกแบบใน 3 ขั้นตอน" className="grid grid-cols-3 gap-2 border-y border-[#e6dfd7] py-5 sm:gap-4">
      {STEPS.map(({icon: Icon, title}, i) => <li key={title} className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-3">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-brand" />
        <span className="text-xs font-medium sm:text-sm"><span className="mr-1.5 text-brand">{i + 1}.</span>{title}</span>
      </li>)}
    </ol>

    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold md:text-2xl">เริ่มจากสไตล์ที่ชอบ</h2>
        <Link href="/feed" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand">ดูห้องจากชุมชน<ArrowRight aria-hidden="true" className="size-4" /></Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {['muji', 'minimal', 'scandi'].map(id => <StyleInspiration key={id} id={id} />)}
      </div>
    </section>
  </div>
}
