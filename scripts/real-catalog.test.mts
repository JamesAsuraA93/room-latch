// node scripts/real-catalog.test.mts — static Shopee snapshot, no network
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseCsv} from '../lib/plan.ts'
import {REAL_CATEGORIES, STYLE_ALIAS, mergeReal, toRealProducts} from '../lib/real-catalog.ts'

const rows = parseCsv(readFileSync(new URL('../../catalog/shopee-real-snapshot.csv', import.meta.url), 'utf8'))
assert.equal(rows.length, 26)
const real = toRealProducts(rows)

// every listing is an exact product page rebuilt from its ids, never a search link; ids allowlist-safe
for (const p of real) {
  assert.match(p.url, /^https:\/\/shopee\.co\.th\/product\/\d+\/\d+$/)
  assert.match(p.id, /^shopee-\d+-\d+$/)
  assert.ok(!p.url.includes('search'))
}
assert.equal(new Set(real.map(p => p.id)).size, real.length, 'dedup by shop/item')

// duplicate rows are dropped
assert.equal(toRealProducts([...rows, rows[0]]).length, real.length)

// dimensions only when the file states them; blank stays null
const byId = (id: string) => real.find(p => p.id === id)!
assert.equal(byId('shopee-752155244-24157985406').dimensions, '123×79×80')
assert.equal(byId('shopee-83433064-5033199117').dimensions, null)

// verification levels
assert.equal(byId('shopee-752155244-24157985406').verification, 'photo')
assert.equal(byId('shopee-954288199-27351400117').verification, 'listing')
assert.equal(byId('shopee-471753071-47000920826').verification, 'gallery_failed')

// rows tagged only warm-modern / mid-century have no app style but stay browsable (styles = [])
assert.deepEqual(byId('shopee-44262368-50052982841').styles, [], 'FUREX: warm-modern|mid-century only')
assert.equal(real.filter(p => p.styles.length === 0).length, 3)
assert.equal(real.length, 26, 'all snapshot rows browsable')
// aliases intact for the original snapshot
assert.deepEqual(byId('shopee-752155244-24157985406').styles.sort(), ['japandi', 'luxe', 'minimal', 'muji', 'nordic', 'scandi'])
assert.deepEqual(STYLE_ALIAS['warm-modern'], [])

// additions: direct app-style tags, no aliasing
const addRows = parseCsv(readFileSync(new URL('../../catalog/shopee-real-additions.csv', import.meta.url), 'utf8'))
assert.equal(addRows.length, 24)
const add = toRealProducts(addRows, 'direct')
assert.equal(add.length, 24)
const a = (id: string) => add.find(p => p.id === id)!
assert.deepEqual(a('shopee-56619907-28935951548').styles, ['loft', 'minimal'], "'minimal' is not aliased to muji in direct mode")
assert.equal(add.filter(p => p.verification === 'photo').length, 10, 'batch 2 gallery-opened rows')
assert.equal(add.filter(p => p.verification === 'listing').length, 14, 'listing-index rows')
assert.equal(a('shopee-992669497-21585006878').dimensions, '45×45')
assert.equal(a('shopee-238526691-12836592220').dimensions, '47×52×76')
assert.equal(a('shopee-195343894-9564965865').dimensions, null, 'rattan chair: two variants, no size')
assert.equal(a('shopee-1240873948-24889369368').dimensions, '50×30×58')
assert.equal(a('shopee-131672050-5139739992').dimensions, '280×250')
assert.equal(a('shopee-51830321-1760620669').dimensions, null, 'RODALM opening is not a footprint')
assert.equal(a('shopee-56619907-28935951548').dimensions, null)
const all = mergeReal(real, add)
assert.equal(all.length, 50)
assert.equal(mergeReal(real, add, add, real).length, 50, 'merge dedups by shop/item')

// coverage: all 8 app styles get real products in several categories (snapshot + additions)
const APP_STYLES = ['minimal', 'muji', 'japandi', 'scandi', 'loft', 'luxe', 'boho', 'nordic']
for (const s of APP_STYLES) {
  const list = all.filter(p => p.styles.includes(s))
  const cats = new Set(list.map(p => p.category))
  console.log(`${s}: ${list.length} products, ${cats.size}/${REAL_CATEGORIES.length} categories`)
  assert.ok(list.length >= 5, `${s} has too few real products`)
  assert.ok(cats.size >= 4, `${s} covers too few categories`)
}
console.log(`real-catalog ok (${all.length} browsable, ${all.filter(p => p.styles.length).length} in an app style)`)
