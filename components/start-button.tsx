'use client'
import {useRouter} from 'next/navigation'
import {Button} from '@/components/ui/button'
import {t} from '@/lib/copy'
import {savePlan, startDemoSession} from '@/lib/demo'

// เริ่ม flow ใหม่เอง (ไม่ใช่ Remix) ล้างป้าย Remix ที่ค้างจากรอบก่อน
export function StartButton({className}: {className?: string}) {
  const router = useRouter()
  return <Button className={className} onClick={() => { savePlan({remixOf: undefined}); router.push('/upload') }}>{t.start}</Button>
}

// ทางลัดเดโม: ข้ามขั้นตอน ไปผลลัพธ์ห้องตัวอย่างค่าเริ่มต้นทันที (ไม่แตะของที่เซฟไว้)
export function DemoButton({className, variant = 'outline'}: {className?: string; variant?: 'outline' | 'ghost' | 'default'}) {
  const router = useRouter()
  return <Button variant={variant} className={className} onClick={() => { startDemoSession(); router.push('/upload') }}>{t.quickDemo}</Button>
}
