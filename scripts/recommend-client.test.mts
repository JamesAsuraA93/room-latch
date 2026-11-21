import assert from 'node:assert/strict'
import {recommendationKey, requestRecommendation} from '../lib/recommend-client.ts'

const store = new Map<string, string>()
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
const originalFetch = globalThis.fetch
const requests: Record<string, unknown>[] = []
let fail = false
let source = 'ai'
Object.defineProperty(globalThis, 'sessionStorage', {configurable: true, value: {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
}})
globalThis.fetch = async (_url, init) => {
  requests.push(JSON.parse(String(init?.body)))
  if (fail) return new Response('', {status: 503})
  return Response.json({source, items: [{id: 'shopee-1-2', title: 'โซฟา', category: 'seating', price: 2500, image: '/api/listings/shopee-1-2/image'}], total: 2500, budget: 5000, summary: 'มุมอ่านหนังสือ'})
}
try {
  const plan = {style: 'minimal', roomType: 'living', budget: 5000, width: 80, need: ' โซฟา 2 ที่นั่ง ไม่เอาพรม '}
  const key = recommendationKey(plan)
  assert.equal(JSON.parse(key).need, plan.need.trim())
  assert.equal(JSON.parse(key).width, undefined, 'legacy default width is not a measurement')
  assert.equal(JSON.parse(recommendationKey(plan, true)).width, 80)
  const [first, second] = await Promise.all([requestRecommendation(key), requestRecommendation(key)])
  assert.equal(requests.length, 1, 'concurrent mounts share one model request')
  assert.deepEqual(first, second)
  assert.equal(first.items[0].image, '/api/listings/shopee-1-2/image', 'recommendations retain photos independently of the page catalog')
  await requestRecommendation(key)
  assert.equal(requests.length, 1, 'back navigation uses the saved answer')
  const changed = recommendationKey({...plan, need: 'โต๊ะทำงาน ไม่เอาโซฟา'})
  await requestRecommendation(changed)
  assert.equal(requests.length, 2, 'changed needs require a different recommendation')
  assert.equal(requests[1].need, 'โต๊ะทำงาน ไม่เอาโซฟา')
  await requestRecommendation(changed, true)
  assert.equal(requests.length, 3, 'explicit refresh requests a new answer')
  fail = true
  await assert.rejects(requestRecommendation(key, true), /recommend_unavailable/)
  fail = false
  await requestRecommendation(key, true)
  assert.equal(requests.length, 5, 'failed requests can be retried')
  source = 'rules'
  await requestRecommendation(key, true)
  source = 'ai'
  const recovered = await requestRecommendation(key)
  assert.equal(recovered.source, 'ai')
  assert.equal(requests.length, 7, 'rules fallback is not cached as a permanent answer')
  console.log('Recommendation request, needs, caching, deduplication and retry passed')
} finally {
  globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'sessionStorage')
}
