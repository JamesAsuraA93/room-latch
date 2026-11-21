import {existsSync, readFileSync} from 'node:fs'
import path from 'node:path'

export type LocalListing = {id: string; title: string; note: string; url: string; x: number; y: number}

/**
 * เดโมในเครื่องเท่านั้น: เปิดเมื่อ ROOMLATCH_LOCAL_DEMO=1 และมี room-latch/local-demo.json (ไฟล์นี้ไม่อยู่ใน Git/export)
 * build สาธารณะ (Vercel) ไม่มีทั้งสองอย่าง จึงได้ null และหน้า Feed เหมือนเดิมทุกประการ
 */
export function loadLocalDemo(): LocalListing[] | null {
  if (process.env.ROOMLATCH_LOCAL_DEMO !== '1') return null
  const file = path.join(process.cwd(), 'local-demo.json')
  if (!existsSync(file)) return null
  return (JSON.parse(readFileSync(file, 'utf8')).listings ?? []) as LocalListing[]
}

const EXAMPLE_DIR = () => path.join(process.cwd(), '..', 'samples', 'private-example')
const EXAMPLE_FILES: Record<string, {name: string; mime: string}> = {
  before: {name: 'living-before.jpg', mime: 'image/jpeg'},
  after: {name: 'living-after.png', mime: 'image/png'},
}

/** Fixed private files only (never a path from the request). null when the local demo is off or not on loopback build. */
export function privateExampleFile(name: string): {path: string; mime: string} | null {
  if (process.env.ROOMLATCH_LOCAL_DEMO !== '1' || process.env.VERCEL) return null
  const f = EXAMPLE_FILES[name]
  return f ? {path: path.join(EXAMPLE_DIR(), f.name), mime: f.mime} : null
}

/** URLs for the Feed hero when both private files exist. */
export function loadPrivateExample(): {before: string; after: string} | null {
  if (!privateExampleFile('before')) return null
  const ok = Object.values(EXAMPLE_FILES).every(f => existsSync(path.join(EXAMPLE_DIR(), f.name)))
  return ok ? {before: '/api/private-example/before', after: '/api/private-example/after'} : null
}
