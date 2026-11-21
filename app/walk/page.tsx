import Link from 'next/link'
import {PageHeader} from '@/components/page-header'
import {Button} from '@/components/ui/button'

// เดินดูห้องแบบ 360°: viewer เป็นไฟล์ static ใน public/walk (three.js ทำงานในเบราว์เซอร์ ไม่มีรูปผู้ใช้ส่งออก)
// ตอนนี้เป็นฉากตัวอย่างที่ทำไว้ล่วงหน้า ฉากจากห้องของผู้ใช้เองต้องรอขั้น compute ฝั่ง server
// scene มาจาก allowlist เท่านั้น ไม่ส่ง path จาก URL เข้า viewer ตรงๆ
const SCENES = {
  'muji-6': {label: 'ครบชุด 6 ชิ้น', hint: 'โซฟา โต๊ะกลาง พรม โคมไฟตั้งพื้น รูปแขวน และต้นไม้ คลิกแต่ละชิ้นเพื่อดูสินค้า'},
  'muji-demo': {label: 'โซฟาชิ้นเดียว', hint: 'คลิกโซฟาเพื่อดูสินค้า'},
} as const
type SceneId = keyof typeof SCENES
const isScene = (v: unknown): v is SceneId => typeof v === 'string' && Object.hasOwn(SCENES, v)

export default async function Walk({searchParams}: {searchParams: Promise<{[key: string]: string | string[] | undefined}>}) {
  const requested = (await searchParams).scene
  const scene: SceneId = isScene(requested) ? requested : 'muji-6'
  const viewer = `/walk/viewer.html?scene=scenes/${scene}`
  return (
    <div className="space-y-4">
      <PageHeader title="เดินดูห้องแบบ 360°">
        ลากเพื่อมองรอบ คลิกตรงที่อยากไปเพื่อเดินไปจุดนั้น · {SCENES[scene].hint} · ฉากตัวอย่างจาก AI ไม่ใช่ห้องของคุณ
      </PageHeader>
      <nav aria-label="เลือกฉาก" className="flex gap-2">
        {(Object.keys(SCENES) as SceneId[]).map(id => (
          <Link key={id} href={`/walk?scene=${id}`} aria-current={id === scene ? 'page' : undefined}
            className={`min-h-10 rounded-full border px-4 py-2 text-sm ${id === scene ? 'border-brand bg-brand-soft font-semibold text-brand' : 'border-zinc-200 bg-white text-ink'}`}>
            {SCENES[id].label}
          </Link>
        ))}
      </nav>
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-900">
        <iframe key={scene} src={viewer} title={`ห้องตัวอย่างแบบ 360 องศา: ${SCENES[scene].label}`} allow="fullscreen"
          className="block h-[70dvh] min-h-[420px] w-full" />
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1"><Link href="/result">กลับไปหน้าผลลัพธ์</Link></Button>
        <Button asChild variant="ghost" className="flex-1"><a href={viewer} target="_blank" rel="noopener">เปิดเต็มจอ ↗</a></Button>
      </div>
    </div>
  )
}
