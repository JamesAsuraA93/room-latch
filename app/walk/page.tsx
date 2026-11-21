import Link from 'next/link'
import {PageHeader} from '@/components/page-header'
import {Button} from '@/components/ui/button'
import {readScene, sceneWebPrefix} from '@/lib/scene-jobs'

// เดินดูห้องแบบ 360°: viewer เป็นไฟล์ static ใน public/walk (three.js ทำงานในเบราว์เซอร์)
// - ?scene=u-<render job id>: ห้องของผู้ใช้เอง สร้างจากภาพผลลัพธ์ (lib/scene-jobs.ts) เปิดได้เมื่อสร้างเสร็จแล้วเท่านั้น
// - ?scene=muji-6 | muji-demo: ฉากตัวอย่างที่ทำไว้ล่วงหน้า
// scene มาจาก allowlist หรือ id ที่ตรวจรูปแบบแล้วเท่านั้น ไม่ส่ง path จาก URL เข้า viewer ตรงๆ
const SCENES = {
  'muji-6': {label: 'ครบชุด 6 ชิ้น', hint: 'โซฟา โต๊ะกลาง พรม โคมไฟตั้งพื้น รูปแขวน และต้นไม้ คลิกแต่ละชิ้นเพื่อดูสินค้า'},
  'muji-demo': {label: 'โซฟาชิ้นเดียว', hint: 'คลิกโซฟาเพื่อดูสินค้า'},
} as const
type SceneId = keyof typeof SCENES
const isScene = (v: unknown): v is SceneId => typeof v === 'string' && Object.hasOwn(SCENES, v)

function Frame({viewer, title}: {viewer: string; title: string}) {
  return <>
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-900">
      <iframe key={viewer} src={viewer} title={title} allow="fullscreen" className="block h-[70dvh] min-h-[420px] w-full" />
    </div>
    <div className="flex gap-2">
      <Button asChild variant="outline" className="flex-1"><Link href="/result">กลับไปหน้าผลลัพธ์</Link></Button>
      <Button asChild variant="ghost" className="flex-1"><a href={viewer} target="_blank" rel="noopener">เปิดเต็มจอ ↗</a></Button>
    </div>
  </>
}

export default async function Walk({searchParams}: {searchParams: Promise<{[key: string]: string | string[] | undefined}>}) {
  const requested = (await searchParams).scene
  const userId = typeof requested === 'string' && requested.startsWith('u-') ? requested.slice(2) : null
  const userScene = userId ? await readScene(userId) : null
  if (userId && userScene?.status === 'succeeded') return (
    <div className="space-y-4">
      <PageHeader title="เดินดูห้องของคุณแบบ 360°">
        ลากเพื่อมองรอบ คลิกตรงที่อยากไปเพื่อเดินไปจุดนั้น · คลิกสินค้าในห้องเพื่อดูประกาศ · ด้านหน้าคือภาพผลลัพธ์ของคุณ ส่วนรอบๆ AI วาดต่อให้ จึงอาจไม่ตรงห้องจริงทุกจุด
      </PageHeader>
      <Frame viewer={`/walk/viewer.html?scene=${sceneWebPrefix(userId)}`} title="ห้องของคุณแบบ 360 องศา" />
    </div>
  )

  const scene: SceneId = isScene(requested) ? requested : 'muji-6'
  return (
    <div className="space-y-4">
      <PageHeader title="เดินดูห้องแบบ 360°">
        ลากเพื่อมองรอบ คลิกตรงที่อยากไปเพื่อเดินไปจุดนั้น · {SCENES[scene].hint} · ฉากตัวอย่างจาก AI ไม่ใช่ห้องของคุณ
      </PageHeader>
      {userId && <p role="status" className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
        ห้อง 360° ของคุณ{userScene?.status === 'running' ? 'ยังสร้างไม่เสร็จ' : 'ยังไม่มีหรือสร้างไม่สำเร็จ'} กลับไปที่หน้าผลลัพธ์เพื่อดูความคืบหน้า ระหว่างนี้แสดงฉากตัวอย่าง
      </p>}
      <nav aria-label="เลือกฉาก" className="flex gap-2">
        {(Object.keys(SCENES) as SceneId[]).map(id => (
          <Link key={id} href={`/walk?scene=${id}`} aria-current={id === scene ? 'page' : undefined}
            className={`min-h-10 rounded-full border px-4 py-2 text-sm ${id === scene ? 'border-brand bg-brand-soft font-semibold text-brand' : 'border-zinc-200 bg-white text-ink'}`}>
            {SCENES[id].label}
          </Link>
        ))}
      </nav>
      <Frame viewer={`/walk/viewer.html?scene=scenes/${scene}`} title={`ห้องตัวอย่างแบบ 360 องศา: ${SCENES[scene].label}`} />
    </div>
  )
}
