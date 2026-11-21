import assert from 'node:assert/strict'
import {isDesignId, parsePublishMeta, publishDesign, PublishError} from '../lib/publish-design.ts'

const id = '00000000-0000-4000-8000-000000000001'
const meta = {style: 'japandi', roomType: 'living', budget: 5000, itemIds: ['shopee-1-2', 'fixture-table']}
assert.ok(isDesignId(id))
for (const bad of ['../secret', `${id}/after`, 'job-1']) assert.equal(isDesignId(bad), false)
assert.deepEqual(parsePublishMeta(meta), meta)
for (const invalid of [null, {...meta, style: 'anything'}, {...meta, budget: -1}, {...meta, budget: 1.5}, {...meta, budget: 1_000_001}, {...meta, itemIds: []}, {...meta, itemIds: ['a', 'a']}, {...meta, itemIds: ['../secret']}, {...meta, itemIds: Array.from({length: 7}, (_, i) => String(i))}]) assert.equal(parsePublishMeta(invalid), null)

function fixture(options: {existing?: {owner_id: string; published_at: string | null}; status?: string; missingProduct?: boolean; failUpload?: boolean; failCommit?: boolean} = {}) {
  const events: string[] = []
  const files = new Map<string, Uint8Array>()
  const after = new Uint8Array([137, 80, 78, 71, 42])
  const inserts: unknown[][] = []
  const connection = {
    async query(sql: string, values: unknown[] = []) {
      if (sql === 'commit' && options.failCommit) throw new Error('lost connection during commit')
      events.push(sql)
      if (sql.startsWith('select owner_id')) return {rows: options.existing ? [options.existing] : []}
      if (sql.startsWith('select status')) return {rows: [{status: options.status || 'succeeded', output_path: `renders/${id}.png`, image_w: 1536, image_h: 1024}]}
      if (sql.includes('from shopee_listings')) return {rows: options.missingProduct ? [] : [{id: 'shopee-1-2', kind: 'listing', price: 2000}, {id: 'fixture-table', kind: 'catalog', price: 500}]}
      if (sql.startsWith('insert into design')) inserts.push(values)
      return {rows: []}
    },
    release() { events.push('release') },
  }
  const store = {
    async download(key: string) { assert.equal(key, `renders/${id}.png`); events.push('download-after'); return {bytes: async () => after} },
    async upload(key: string, bytes: Uint8Array) {
      events.push(`upload:${key}`); files.set(key, bytes)
      if (options.failUpload && key.endsWith('after.png')) throw new Error('storage down')
    },
    async delete(key: string) { events.push(`delete:${key}`); files.delete(key) },
  }
  return {events, files, inserts, after, run: () => publishDesign({id, ownerId: 'user-a', meta, before: new Uint8Array([255, 216, 255]), pool: {connect: async () => connection} as never, store})}
}

const success = fixture()
assert.deepEqual(await success.run(), {id, created: true})
assert.deepEqual(success.files.get(`designs/${id}/after.png`), success.after, 'public After is the real render, not a style image')
assert.deepEqual(success.files.get(`designs/${id}/before.jpg`), new Uint8Array([255, 216, 255]))
assert.equal(success.inserts[0][5], 2500, 'total comes from catalog prices')
assert.deepEqual(success.inserts[1], [id, 0, 'shopee-1-2', null])
assert.deepEqual(success.inserts[2], [id, 1, null, 'fixture-table'])
assert.ok(success.events.indexOf(`upload:designs/${id}/after.png`) < success.events.findIndex(e => e.startsWith('insert into designs')), 'only publish after both images are stored')
assert.equal(success.events.at(-2), 'commit')
assert.equal(success.events.at(-1), 'release')

const duplicate = fixture({existing: {owner_id: 'user-a', published_at: '2026-11-21'}})
assert.deepEqual(await duplicate.run(), {id, created: false})
assert.equal(duplicate.files.size, 0, 'retry never reuploads or duplicates a post')
assert.equal(duplicate.inserts.length, 0)
for (const [options, code] of [
  [{existing: {owner_id: 'user-b', published_at: '2026-11-21'}}, 'design_unavailable'],
  [{status: 'running'}, 'render_not_ready'], [{status: 'failed'}, 'render_not_ready'],
  [{missingProduct: true}, 'unknown_product'],
] as const) {
  const refused = fixture(options)
  await assert.rejects(refused.run(), e => e instanceof PublishError && e.code === code)
  assert.equal(refused.files.size, 0)
  assert.equal(refused.inserts.length, 0)
  assert.ok(refused.events.includes('rollback'))
  assert.equal(refused.events.at(-1), 'release')
}
const failed = fixture({failUpload: true})
await assert.rejects(failed.run(), /storage down/)
assert.equal(failed.inserts.length, 0, 'a failed upload cannot publish a broken pair')
assert.equal(failed.files.size, 0, 'partial uploads are cleaned up before releasing the lock')
assert.ok(failed.events.findIndex(e => e.startsWith('delete:')) < failed.events.indexOf('rollback'))
const uncertain = fixture({failCommit: true})
await assert.rejects(uncertain.run(), /lost connection/)
assert.equal(uncertain.files.size, 2, 'an ambiguous COMMIT must not destroy images of a possibly published post')
console.log('Design sharing: validation, actual image pair, retry, ownership and rollback passed')
