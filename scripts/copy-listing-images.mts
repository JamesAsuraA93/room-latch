// Copy each listing's Shopee photo (shopee_listings.image_url) into the private "assets" bucket at
// listings/<shop>-<item>/original.<ext> and record it in image_path. Server-side AI input only
// (segmentation, reference images): never serve these files to users.
//
//   node --env-file=.env.local scripts/copy-listing-images.mts           # copy everything not copied yet
//   node scripts/copy-listing-images.mts --self-test                      # offline checks
//
// Env: DATABASE_URL_UNPOOLED (or DATABASE_URL) + AWS_* for Neon Object Storage. Optional COPY_LIMIT.
// Rerunnable: only rows with image_url set and image_path null are fetched.
import assert from 'node:assert/strict'
import {PutObjectCommand, S3Client} from '@aws-sdk/client-s3'
import pg from 'pg'
import {sniffImage} from '../lib/live-render-core.ts'

const MAX_BYTES = 8 * 1024 * 1024
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36'

/** 'shopee-12-34' + jpg -> 'listings/12-34/original.jpg' (matches the image_path DB check). */
export function keyFor(id: string, ext: string): string | null {
  const m = /^shopee-(\d+)-(\d+)$/.exec(id)
  return m && ['jpg', 'png', 'webp'].includes(ext) ? `listings/${m[1]}-${m[2]}/original.${ext}` : null
}

/** Only Shopee's own image CDN; image_url came from scraped data, so never fetch an arbitrary host. */
export const allowedUrl = (u: string) => { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)susercontent\.com$/.test(x.hostname) } catch { return false } }

async function pool<T>(xs: T[], n: number, f: (x: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({length: n}, async () => { while (i < xs.length) await f(xs[i++]) }))
}

function selfTest() {
  assert.equal(keyFor('shopee-12-34', 'jpg'), 'listings/12-34/original.jpg')
  assert.equal(keyFor('shopee-12-34', 'gif'), null)
  assert.equal(keyFor('../x', 'jpg'), null)
  assert.ok(allowedUrl('https://down-th.img.susercontent.com/file/abc'))
  assert.ok(!allowedUrl('https://evil.example/susercontent.com'))
  assert.ok(!allowedUrl('http://down-th.img.susercontent.com/file/abc'))
  console.log('copy-listing-images self-test ok')
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest()
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is not set')
  const s3 = new S3Client({forcePathStyle: true}) // Neon requires path-style; endpoint/creds from AWS_* env
  const db = new pg.Pool({connectionString: url, max: 4}) // pool reconnects if Neon suspends mid-run
  const limit = Number(process.env.COPY_LIMIT) || 100000
  const {rows} = await db.query<{id: string; image_url: string}>(
    'select id, image_url from shopee_listings where image_url is not null and image_path is null order by id limit $1', [limit])
  console.log(`${rows.length} listings to copy`)
  let ok = 0, failed = 0, bytes = 0
  await pool(rows, 6, async r => {
    try {
      if (!allowedUrl(r.image_url)) throw new Error('host not allowed')
      const res = await fetch(r.image_url, {headers: {'user-agent': UA}})
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = new Uint8Array(await res.arrayBuffer())
      if (body.length > MAX_BYTES) throw new Error('too large')
      const kind = sniffImage(body) // trust the bytes, not the Content-Type header
      const key = kind && keyFor(r.id, kind.ext)
      if (!kind || !key) throw new Error('not a jpg/png/webp')
      await s3.send(new PutObjectCommand({Bucket: 'assets', Key: key, Body: body, ContentType: kind.mime}))
      await db.query('update shopee_listings set image_path = $2 where id = $1', [r.id, key])
      ok++; bytes += body.length
      if (ok % 250 === 0) console.log(`${ok} copied (${Math.round(bytes / 1048576)} MB)`)
    } catch (e) { failed++; console.warn(`${r.id}: ${(e as Error).message}`) }
  })
  await db.end()
  console.log(`done: ${ok} copied, ${failed} failed, ${Math.round(bytes / 1048576)} MB`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
