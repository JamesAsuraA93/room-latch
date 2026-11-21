// Gather real Shopee TH listings per app style × category into Neon (shopee_listings, source 'search').
//
//   node --env-file=.env.local scripts/gather-shopee.mts            # gather + classify + upsert
//   node --env-file=.env.local scripts/gather-shopee.mts --dry      # no DB writes, prints counts
//   node scripts/gather-shopee.mts --self-test                      # offline checks only
//
// Env: DATABASE_URL_UNPOOLED (or DATABASE_URL). Optional ROOMLATCH_CODEX_BIN, GATHER_PAGES (default 1).
// Needs db/migrations/001-shopee-gathered.sql applied. Rerunnable: upserts by shop/item id and only
// classifies items not already stored, so a rerun adds new finds and refreshes price/rating/image.
//
// Source: Shopee's public web search JSON, one request every ~1.5 s, no login. If Shopee answers with
// anything but JSON items (block, captcha, rate limit) the script stops that query and moves on; it never
// tries to get around it. "Codex Decision": the local Codex CLI reads titles in batches and decides
// keep/drop, category and styles. Rows are stored with verification 'listing' (listing seen in search,
// photo URL checked to load, photo not matched by a person).
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import pg from 'pg'
import {REAL_CATEGORIES} from '../lib/real-catalog.ts'
import {STYLE_IDS, isStyleId} from '../lib/styles.ts'
import {CATEGORY_SEARCH_WORDS, listingId as idOf, parseSearch, searchShopee, shopeeImage, SHOPEE_UA as UA, STYLE_SEARCH_WORDS, type Candidate} from '../lib/shopee-search.ts'

type Cat = typeof REAL_CATEGORIES[number]
export type {Candidate}
export type Decision = {id: string; keep: boolean; category: Cat; styles: string[]}

const STYLE_WORDS = STYLE_SEARCH_WORDS
const CAT_WORDS = CATEGORY_SEARCH_WORDS as Record<Cat, string[]>
const IMG = (hash: string) => shopeeImage(hash)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
export {parseSearch}

/** Keep only well-formed keep=true decisions for ids we sent, with ≥1 valid app style. */
export function cleanDecisions(raw: any, ids: Set<string>): Decision[] {
  const items = Array.isArray(raw?.items) ? raw.items : []
  return items.flatMap((d: any) => {
    if (!d?.keep || !ids.has(d.id) || !REAL_CATEGORIES.includes(d.category)) return []
    const styles = [...new Set((d.styles ?? []).filter(isStyleId))] as string[]
    return styles.length ? [{id: d.id, keep: true, category: d.category, styles}] : []
  })
}

const search = (keyword: string, page: number) => searchShopee(keyword, page)

async function gather(pages: number) {
  const all = new Map<string, Candidate>()
  for (const [style, sw] of Object.entries(STYLE_WORDS)) for (const cat of REAL_CATEGORIES) for (const cw of CAT_WORDS[cat]) for (let p = 0; p < pages; p++) {
    const kw = `${cw} ${sw}`
    try {
      for (const c of parseSearch(await search(kw, p), `${style}/${cat}`)) {
        const prev = all.get(idOf(c))
        if (prev) prev.hints.add(`${style}/${cat}`); else all.set(idOf(c), c)
      }
    } catch (e) { console.warn(`search "${kw}" p${p} skipped: ${(e as Error).message}`) }
    await sleep(1500)
  }
  return all
}

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: {items: {type: 'array', items: {type: 'object', additionalProperties: false, required: ['id', 'keep', 'category', 'styles'],
    properties: {id: {type: 'string'}, keep: {type: 'boolean'}, category: {type: 'string', enum: [...REAL_CATEGORIES]},
      styles: {type: 'array', items: {type: 'string', enum: STYLE_IDS}}}}}},
}

const PROMPT = `You classify Shopee Thailand listings for an interior-design app. For EVERY input line return one item.
keep=true only if it is a single piece of home furniture or decor a buyer could place in a living room or bedroom
(not parts, refills, bulbs only, stickers, wallpaper, kids toys, outdoor/office-only, clothing, sets of unrelated items).
category: seating (sofa, chair, stool, bench, pouf), table (coffee/side/dining/desk/console), light (lamps, pendants),
textile (rugs, curtains, cushions, throws, bedding), accent (vases, shelves, mirrors, plants/pots, wall art, storage, clocks).
styles: 1-3 of minimal, muji, japandi, scandi, loft, luxe, boho, nordic that the product's look honestly fits
(loft = industrial metal/dark wood, luxe = modern luxury marble/gold/velvet, muji = plain light wood/linen, boho = rattan/macrame).
The "hint" is the search that found it; trust the title over the hint. No commentary: output only the JSON.
Lines are: id | title | hint\n\n`

export async function codexDecide(batch: Candidate[], bin: string): Promise<Decision[]> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rl-codex-'))
  try {
    await writeFile(path.join(dir, 'schema.json'), JSON.stringify(SCHEMA))
    const lines = batch.map(c => `${idOf(c)} | ${c.title.replace(/[\n|]/g, ' ')} | ${[...c.hints].join(',')}`).join('\n')
    const args = ['exec', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-s', 'read-only', '-C', dir,
      '--output-schema', path.join(dir, 'schema.json'), '-o', path.join(dir, 'out.json'), '-']
    // Minimal env: the DB URL never reaches the Codex child.
    const env = {PATH: '/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin', HOME: process.env.HOME ?? '', USER: process.env.USER ?? '', LANG: 'en_US.UTF-8', TMPDIR: dir}
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(bin, args, {cwd: dir, env, stdio: ['pipe', 'ignore', 'ignore']})
      const timer = setTimeout(() => child.kill('SIGKILL'), 10 * 60_000)
      child.on('error', reject)
      child.on('exit', c => { clearTimeout(timer); resolve(c) })
      child.stdin.end(PROMPT + lines)
    })
    if (code !== 0) throw new Error(`codex exit ${code}`)
    return cleanDecisions(JSON.parse(await readFile(path.join(dir, 'out.json'), 'utf8')), new Set(batch.map(idOf)))
  } finally { await rm(dir, {recursive: true, force: true}) }
}

async function imageLoads(hash: string) {
  try {
    const res = await fetch(IMG(hash), {method: 'HEAD', headers: {'user-agent': UA}})
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')
  } catch { return false }
}

async function pool<T, R>(xs: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length); let i = 0
  await Promise.all(Array.from({length: n}, async () => { while (i < xs.length) { const k = i++; out[k] = await f(xs[k]) } }))
  return out
}

async function upsert(client: pg.Client, rows: {c: Candidate; d: Decision}[]) {
  for (let i = 0; i < rows.length; i += 50) {
    await client.query('begin')
    for (const {c, d} of rows.slice(i, i + 50)) {
      // Curated rows (snapshot/addition/exact_match) are never overwritten; only 'search' rows refresh.
      const r = await client.query(
        `insert into shopee_listings (id, shop_id, item_id, title, category, verification, evidence_status, source, checked_on, image_url, price_thb, shop_name, rating)
         values ($1, $2, $3, $4, $5, 'listing', 'shopee_search_api+codex_decision', 'search', current_date, $6, $7, $8, $9)
         on conflict (id) do update set title = excluded.title, category = excluded.category, checked_on = excluded.checked_on,
           image_url = excluded.image_url, price_thb = excluded.price_thb, shop_name = excluded.shop_name, rating = excluded.rating
         where shopee_listings.source = 'search'
         returning id`,
        [d.id, c.shop, c.item, c.title, d.category, IMG(c.image), c.price, c.shopName, c.rating])
      if (!r.rowCount) continue
      await client.query('delete from shopee_listing_styles where listing_id = $1', [d.id])
      await client.query('insert into shopee_listing_styles (listing_id, style_id) select $1, unnest($2::text[])', [d.id, d.styles])
    }
    await client.query('commit')
  }
}

function selfTest() {
  const json = {items: [{item_basic: {itemid: 2, shopid: 1, name: ' Lamp ', image: 'th-abc', price: 25900000, item_rating: {rating_star: 4.876}, shop_name: 'S'}},
    {item_basic: {itemid: 3, shopid: 1, name: 'bad', image: '../x'}}, {}]}
  const [c, ...rest] = parseSearch(json, 'japandi/light')
  assert.equal(rest.length, 0)
  assert.deepEqual({...c, hints: [...c.hints]}, {shop: 1, item: 2, title: 'Lamp', image: 'th-abc', price: 259, rating: 4.88, shopName: 'S', hints: ['japandi/light']})
  assert.throws(() => parseSearch({error: 90309999}, 'x'))
  const ds = cleanDecisions({items: [
    {id: 'shopee-1-2', keep: true, category: 'light', styles: ['japandi', 'evil', 'japandi']},
    {id: 'shopee-1-9', keep: true, category: 'light', styles: ['japandi']}, // id not sent
    {id: 'shopee-1-3', keep: false, category: 'light', styles: ['muji']},
    {id: 'shopee-1-4', keep: true, category: 'chair', styles: ['muji']},
    {id: 'shopee-1-5', keep: true, category: 'table', styles: []},
  ]}, new Set(['shopee-1-2', 'shopee-1-3', 'shopee-1-4', 'shopee-1-5']))
  assert.deepEqual(ds, [{id: 'shopee-1-2', keep: true, category: 'light', styles: ['japandi']}])
  console.log('gather-shopee self-test ok')
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest()
  const dry = process.argv.includes('--dry')
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is not set')
  const bin = process.env.ROOMLATCH_CODEX_BIN || '/opt/homebrew/bin/codex'
  // Codex decisions (kept or dropped) are cached per item id so a rerun or crash never pays for them twice.
  const cachePath = process.env.GATHER_CACHE || path.join(process.cwd(), '.gather-decisions.json')
  const cache: Record<string, Decision | null> = await readFile(cachePath, 'utf8').then(JSON.parse, () => ({}))
  const withDb = async <T,>(f: (c: pg.Client) => Promise<T>) => {
    // Short-lived connections: Neon suspends idle computes during the long Codex phase.
    const client = new pg.Client({connectionString: url})
    await client.connect()
    try { return await f(client) } finally { await client.end() }
  }
  {
    const found = await gather(Math.max(1, Number(process.env.GATHER_PAGES) || 1))
    const known = await withDb(async c => new Set((await c.query<{id: string}>('select id from shopee_listings')).rows.map(r => r.id)))
    const fresh = [...found.values()].filter(c => !known.has(idOf(c)))
    const todo = fresh.filter(c => !(idOf(c) in cache))
    console.log(`found ${found.size} unique items, ${fresh.length} not in DB, ${todo.length} to classify`)

    let saving = Promise.resolve()
    const batches: Candidate[][] = []
    for (let i = 0; i < todo.length; i += 120) batches.push(todo.slice(i, i + 120))
    await pool(batches, 3, async b => {
      try {
        const d = await codexDecide(b, bin)
        for (const c of b) cache[idOf(c)] = null
        for (const x of d) cache[x.id] = x
        await (saving = saving.then(() => writeFile(cachePath, JSON.stringify(cache)))) // serialized: workers share one file
        console.log(`codex kept ${d.length}/${b.length}`)
      } catch (e) { console.warn(`codex batch skipped: ${(e as Error).message}`) }
    })
    const decided = fresh.map(c => cache[idOf(c)]).filter((d): d is Decision => !!d)

    const byId = new Map(fresh.map(c => [idOf(c), c]))
    const ok = await pool(decided, 8, async d => (await imageLoads(byId.get(d.id)!.image)) ? d : null)
    const rows = ok.filter((d): d is Decision => !!d).map(d => ({c: byId.get(d.id)!, d}))
    console.log(`${rows.length} kept with loading images (${decided.length - rows.length} image failures)`)

    // Refresh price/rating/image for search rows seen again (no reclassification).
    const seen = [...found.values()].filter(c => known.has(idOf(c)))
    if (!dry) await withDb(async client => {
      await upsert(client, rows)
      for (const c of seen) await client.query(
        `update shopee_listings set image_url = $2, price_thb = $3, rating = $4, shop_name = $5, checked_on = current_date where id = $1 and source = 'search'`,
        [idOf(c), IMG(c.image), c.price, c.rating, c.shopName])
    })

    const {rows: counts} = await withDb(client => client.query(
      `select s.style_id, l.category, count(*)::int n from shopee_listings l join shopee_listing_styles s on s.listing_id = l.id
        group by 1, 2 order by 1, 2`))
    const per: Record<string, Record<string, number>> = {}
    for (const r of counts) (per[r.style_id] ??= {})[r.category] = r.n
    console.table(Object.fromEntries(Object.entries(per).map(([s, c]) => [s, {...c, total: Object.values(c).reduce((a, b) => a + b, 0)}])))
  }
}

if (import.meta.main) main().catch(e => { console.error(e.message); process.exit(1) })
