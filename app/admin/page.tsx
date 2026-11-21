import {notFound} from 'next/navigation'
import {PageHeader} from '@/components/page-header'
import {adminOverview} from '@/lib/db'
import {currentUser, isAdmin} from '@/lib/auth'
import {REAL_CATEGORIES} from '@/lib/real-catalog'
import {STYLE_IDS} from '@/lib/styles'
import {styleName} from '@/lib/demo'

export const dynamic = 'force-dynamic'
export const metadata = {title: 'Admin · RoomLatch', robots: {index: false}}

const CAT: Record<string, string> = {seating: 'ที่นั่ง', table: 'โต๊ะ', light: 'ไฟ', textile: 'ผ้า/พรม', accent: 'ของตกแต่ง'}
const date = (s: string | null) => s ? new Date(s).toLocaleDateString('th-TH', {day: 'numeric', month: 'short', year: '2-digit'}) : '–'
const th = 'px-2 py-1.5 text-left font-semibold text-zinc-500'
const td = 'px-2 py-1.5 align-top'

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return <section className="space-y-2 rounded-3xl border border-zinc-200 bg-white p-4"><h2 className="text-base font-bold">{title}</h2><div className="overflow-x-auto">{children}</div></section>
}

export default async function Admin() {
  // 404, not 403: non-admins should not learn the page exists
  if (!isAdmin(await currentUser())) notFound()
  let data
  try { data = await adminOverview() } catch (e) {
    return <div className="space-y-4"><PageHeader title="Admin" /><p className="text-sm text-red-700">อ่านฐานข้อมูลไม่ได้: {(e as Error).message}</p></div>
  }
  const {totals, grid, recentListings, users, recentDesigns} = data
  const cell = (s: string, c: string) => grid.find(g => g.style === s && g.category === c)?.n ?? 0
  const stats: [string, number][] = [['สินค้า Shopee', totals.listings], ['จากการค้นหา', totals.search], ['คัดมือ', totals.curated],
    ['ผู้ใช้', totals.users], ['ดีไซน์', totals.designs], ['โพสต์ใน Feed', totals.published], ['ไลก์', totals.likes], ['บันทึก', totals.saves]]

  return (
    <div className="space-y-5 text-sm">
      <PageHeader title="Admin">ภาพรวมข้อมูลในฐานข้อมูล Neon (อ่านอย่างเดียว)</PageHeader>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-2xl bg-brand-soft p-3"><p className="text-xs text-zinc-600">{label}</p><p className="text-xl font-bold text-ink">{n.toLocaleString('th-TH')}</p></div>
        ))}
      </div>

      <Section title="สินค้าต่อสไตล์ × หมวด">
        <table className="w-full text-xs tabular-nums">
          <thead><tr><th className={th}>สไตล์</th>{REAL_CATEGORIES.map(c => <th key={c} className={th}>{CAT[c]}</th>)}<th className={th}>รวม</th></tr></thead>
          <tbody>{STYLE_IDS.map(s => {
            const row = REAL_CATEGORIES.map(c => cell(s, c))
            return <tr key={s} className="border-t border-zinc-100"><td className={td}>{styleName(s)}</td>
              {row.map((n, i) => <td key={i} className={`${td} ${n < 10 ? 'font-semibold text-amber-700' : ''}`}>{n}</td>)}
              <td className={`${td} font-semibold`}>{row.reduce((a, b) => a + b, 0)}</td></tr>
          })}</tbody>
        </table>
        <p className="mt-1 text-[11px] text-zinc-500">สีส้ม = น้อยกว่า 10 ชิ้น · สินค้าหนึ่งชิ้นอยู่ได้หลายสไตล์</p>
      </Section>

      <Section title={`ผู้ใช้ที่สมัคร (${totals.users})`}>
        {users.length === 0 ? <p className="text-xs text-zinc-500">ยังไม่มีผู้ใช้สมัคร</p> : (
          <table className="w-full text-xs">
            <thead><tr><th className={th}>Handle</th><th className={th}>ชื่อ</th><th className={th}>อีเมล</th><th className={th}>สมัครเมื่อ</th><th className={th}>ดีไซน์</th><th className={th}>โพสต์</th></tr></thead>
            <tbody>{users.map(u => <tr key={u.user_id} className="border-t border-zinc-100"><td className={td}>@{u.handle}</td><td className={td}>{u.display_name}</td><td className={td}>{u.email ?? '–'}</td><td className={td}>{date(u.created_at)}</td><td className={td}>{u.designs}</td><td className={td}>{u.published}</td></tr>)}</tbody>
          </table>
        )}
      </Section>

      <Section title={`ดีไซน์ล่าสุด (${totals.designs})`}>
        {recentDesigns.length === 0 ? <p className="text-xs text-zinc-500">ยังไม่มีดีไซน์</p> : (
          <table className="w-full text-xs">
            <thead><tr><th className={th}>เจ้าของ</th><th className={th}>สไตล์</th><th className={th}>ห้อง</th><th className={th}>ชื่อ</th><th className={th}>สร้าง</th><th className={th}>โพสต์</th></tr></thead>
            <tbody>{recentDesigns.map(d => <tr key={d.id} className="border-t border-zinc-100"><td className={td}>@{d.handle}</td><td className={td}>{styleName(d.style_id)}</td><td className={td}>{d.room_type}</td><td className={td}>{d.title || '–'}</td><td className={td}>{date(d.created_at)}</td><td className={td}>{date(d.published_at)}</td></tr>)}</tbody>
          </table>
        )}
      </Section>

      <Section title="สินค้าล่าสุด (50 รายการ)">
        <table className="w-full text-xs">
          <thead><tr><th className={th}>ชื่อ</th><th className={th}>หมวด</th><th className={th}>ราคา</th><th className={th}>เรตติ้ง</th><th className={th}>ร้าน</th><th className={th}>เช็กเมื่อ</th></tr></thead>
          <tbody>{recentListings.map(l => <tr key={l.id} className="border-t border-zinc-100">
            <td className={`${td} max-w-64`}><a href={l.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-brand">{l.title}</a></td>
            <td className={td}>{CAT[l.category]}</td><td className={`${td} tabular-nums`}>{l.price_thb ? `฿${Number(l.price_thb).toLocaleString('th-TH')}` : '–'}</td>
            <td className={td}>{l.rating ?? '–'}</td><td className={td}>{l.shop_name ?? '–'}</td><td className={td}>{date(l.checked_on)}</td></tr>)}</tbody>
        </table>
      </Section>
    </div>
  )
}
