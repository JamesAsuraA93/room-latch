// node scripts/decisions.test.mts — Decisions API request builders and parsers, no network
import assert from 'node:assert/strict'
import {DECISION_BATCH, DECISIONS_URL, DecisionsError, classifyRequest, decide, decideAll, decisionsUsd, fitRequest, fitScore, matchRequest, parseClassify, parseFit, parseMatch} from '../lib/decisions.ts'

const room = 'data:image/jpeg;base64,AAAA'
const cands = [{id: 'shopee-1-2', category: 'seating', imageUrl: 'https://cdn/x.jpg'}, {id: 'shopee-1-3', category: 'light', imageUrl: 'https://cdn/y.jpg'}]

// fit request: shared room photo in input, every question carries its own candidate image, names unique
const fit = fitRequest(room, {th: 'มูจิ', prompt: 'ไม้สีอ่อน'}, cands)
assert.equal(fit.model, 'gpt-6-luna')
assert.equal(JSON.stringify(fit.input).includes(room), true)
assert.equal(fit.questions.length, 8)
assert.equal(new Set(fit.questions.map(q => q.name)).size, 8)
for (const [i, c] of cands.entries()) {
  const mine = fit.questions.filter(q => q.name.startsWith(`q${i}_`))
  assert.equal(mine.length, 4)
  assert.ok(mine.every(q => JSON.stringify(q.instructions).includes(c.imageUrl)), 'each question shows its own candidate')
}
assert.match(JSON.stringify(fit.questions[0].instructions), /sofa/)
assert.match(JSON.stringify(fit.questions[4].instructions), /lamp/)

// fit parsing: refusals and missing answers count as 0, so a refused candidate can never top the list
const fitted = parseFit({answers: [
  {type: 'predicate', name: 'q0_is', probability: 1}, {type: 'predicate', name: 'q0_clean', probability: 1},
  {type: 'predicate', name: 'q0_full', probability: 1}, {type: 'score', name: 'q0_style', score: 2.5},
  {type: 'refusal', name: 'q1_is'}, {type: 'predicate', name: 'q1_clean', probability: 1}, {type: 'score', name: 'q1_style', score: 3},
]}, cands)
assert.deepEqual(fitted.map(f => [f.id, f.score]), [['shopee-1-2', 2.5], ['shopee-1-3', 0]])
assert.equal(fitScore({isProduct: 1, fullSize: 0.1, clean: 1, style: 3}).toFixed(2), '0.30', 'toys and miniatures sink')
assert.equal(fitScore({isProduct: 1, fullSize: 1, clean: 0, style: 2}), 1, 'a cluttered photo halves the score')

// match request + parsing
const match = matchRequest(room, 'light', cands)
assert.equal(match.questions.length, 4)
assert.match(JSON.stringify(match.questions[0].instructions), /lamp/)
assert.deepEqual(parseMatch({answers: [{type: 'predicate', name: 'q0_is', probability: 0.5}, {type: 'score', name: 'q0_like', score: 2}]}, cands)
  .map(m => m.score), [1, 0])

// classify
const cls = classifyRequest(room, ['seating', 'light'], ['muji', 'loft'])
assert.deepEqual(cls.questions.map(q => q.name), ['category', 'style'])
assert.deepEqual(parseClassify({answers: [{type: 'choice', name: 'category', choice: 'light'}, {type: 'refusal', name: 'style'}]}), {category: 'light', style: null})

// decide: key from env, JSON body, typed errors that never carry the key or the response body
let seen: {url: string; init: RequestInit} | null = null
const ok = (async (url: string, init: RequestInit) => { seen = {url, init}; return new Response(JSON.stringify({answers: [], usage: {input_tokens: 10}})) }) as typeof fetch
await decide(fit, {env: {OPENAI_API_KEY: 'sk-test'}, fetchImpl: ok})
assert.equal(seen!.url, DECISIONS_URL)
assert.equal((seen!.init.headers as Record<string, string>).Authorization, 'Bearer sk-test')
assert.equal(JSON.parse(String(seen!.init.body)).model, 'gpt-6-luna')
await assert.rejects(decide(fit, {env: {}, fetchImpl: ok}), (e: DecisionsError) => e.code === 'missing_api_key')
const fail = (async () => new Response('secret upstream text', {status: 429})) as unknown as typeof fetch
await assert.rejects(decide(fit, {env: {OPENAI_API_KEY: 'sk-test'}, fetchImpl: fail}),
  (e: DecisionsError) => e.code === 'http_error' && e.status === 429 && !e.message.includes('secret') && !e.message.includes('sk-test'))
const junk = (async () => new Response('not json')) as unknown as typeof fetch
await assert.rejects(decide(fit, {env: {OPENAI_API_KEY: 'k'}, fetchImpl: junk}), (e: DecisionsError) => e.code === 'bad_response')

// decideAll: batches of DECISION_BATCH, rows in input order, tokens summed
const many = Array.from({length: DECISION_BATCH * 2 + 3}, (_, i) => ({id: `shopee-1-${i}`, category: 'table', imageUrl: `https://cdn/${i}.jpg`}))
let calls = 0
const counting = (async (_u: string, init: RequestInit) => {
  calls++
  const body = JSON.parse(String(init.body))
  const answers = body.questions.filter((q: {name: string}) => q.name.endsWith('_style')).map((q: {name: string}) => ({type: 'score', name: q.name, score: 1}))
  return new Response(JSON.stringify({answers, usage: {input_tokens: 100}}))
}) as typeof fetch
const all = await decideAll(many, b => fitRequest(room, {th: 'x', prompt: 'y'}, b), parseFit, {env: {OPENAI_API_KEY: 'k'}, fetchImpl: counting})
assert.equal(calls, 3)
assert.deepEqual(all.rows.map(r => r.id), many.map(m => m.id))
assert.equal(all.inputTokens, 300)
assert.equal(decisionsUsd(1_000_000), 0.1)

console.log('decisions request builders, parsing, errors and batching ok')
